/**
 * Inventario de equipos, préstamos y bitácora de auditoría. También incluye
 * la recepción de dispositivos externos para reparación ("devices"), que
 * crea a la vez un ticket de soporte asociado.
 *
 * Un equipo de inventario se maneja en uno de dos modos, fijado al crearlo:
 * - `'unidad'`: equipo físico con número de serie, solo puede prestarse a una
 *   persona a la vez (su `estado` refleja disponibilidad real).
 * - `'cantidad'`: lote sin serie individual, admite préstamos parciales
 *   simultáneos mientras haya stock (ver {@link getCantidadPrestada}).
 *
 * Todas las rutas de este archivo están protegidas por el permiso de módulo
 * correspondiente (`inventario`, `prestamos` o `bitacora`), otorgado por el
 * superadmin — ver `middleware/auth.ts`.
 * Montado en `server.ts` bajo el prefijo `/api` (rutas ya incluyen su propio
 * segmento, ej. `/inventory`, `/loans`, `/devices`, `/auditoria`).
 */
import express, { Request, Response } from 'express';
import db from '../db';
import { fmtDate, logAudit } from '../helpers';
import { loadTicket } from '../ticketLoader';
import { requireSuperadminOrAcceso } from '../middleware/auth';
import { mobileSessions } from '../mobileSessions';

/**
 * Resuelve un `mobileToken` (sesión de subida por QR, ver `mobileSessions.ts`)
 * a la ruta del archivo ya guardado en `/uploads`. Solo borra la sesión en
 * memoria (no el archivo): así el barrido periódico de `mobileSessions` ya
 * no la considera "huérfana" y no elimina la foto recién asociada al equipo.
 * @param mobileToken Token de sesión móvil recibido en el body, o `undefined`/valor no-string.
 * @returns La ruta pública del archivo (`/uploads/...`), o `null` si el token no es válido o el archivo no está listo.
 */
function resolveMobilePhoto(mobileToken: unknown): string | null {
  if (typeof mobileToken !== 'string' || !mobileToken) return null;
  const s = mobileSessions.get(mobileToken);
  if (!s || s.status !== 'ready' || !s.file) return null;
  mobileSessions.delete(mobileToken);
  return s.file.path;
}

/**
 * Variante multi-foto de {@link resolveMobilePhoto}: resuelve una lista de
 * tokens de sesión móvil a las rutas de **todos** los archivos acumulados en
 * cada sesión (flujo de fotos de entrega de un préstamo). Igual que el helper
 * de una sola foto, borra la sesión de memoria (no los archivos) para que el
 * barrido de `mobileSessions` no elimine las fotos recién asociadas.
 * @param mobileTokens Arreglo de tokens recibido en el body (o valor no-arreglo).
 * @returns Rutas públicas (`/uploads/...`) de todas las fotos resueltas, sin duplicados.
 */
function resolveMobilePhotos(mobileTokens: unknown): string[] {
  if (!Array.isArray(mobileTokens)) return [];
  const paths: string[] = [];
  for (const token of mobileTokens) {
    if (typeof token !== 'string' || !token) continue;
    const s = mobileSessions.get(token);
    if (!s || s.status !== 'ready' || !s.files.length) continue;
    for (const f of s.files) paths.push(f.path);
    mobileSessions.delete(token);
  }
  return paths;
}

const router = express.Router();

const CONDICIONES   = ['nuevo', 'excelente', 'bueno', 'regular', 'danado'];
const ESTADOS_INV   = ['disponible', 'en_uso', 'en_prestamo', 'en_reparacion', 'de_baja'];
const TIPOS_MANEJO  = ['unidad', 'cantidad'];

/**
 * Calcula cuánto de un ítem de tipo `'cantidad'` está prestado ahora mismo:
 * suma `cantidad - cantidad_devuelta` de todos sus préstamos activos.
 * @param inventarioId Id del ítem de inventario (ej. `"INV-001"`).
 * @returns Unidades actualmente prestadas (0 si no hay préstamos activos).
 */
async function getCantidadPrestada(inventarioId: string): Promise<number> {
  const row = await db.queryOne<any>(
    `SELECT ISNULL(SUM(cantidad - cantidad_devuelta), 0) AS prestado
     FROM prestamos WHERE inventario_id = ? AND estado = 'activo'`,
    [inventarioId]
  );
  return row?.prestado || 0;
}

/**
 * GET /api/devices
 * Lista los dispositivos externos recibidos para diagnóstico/reparación
 * (equipos de clientes, no del inventario propio).
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Respuesta 200: `Array<{ id, tipo, marca, modelo, serie, estadoFisico, fallaCliente, accesorios, clienteNombre, clienteTel, tecnico, fecha, fechaTs }>`
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar dispositivos.
 */
router.get('/devices', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const devices = await db.exec<any>('sp_GetDevices');
    res.json(devices.map(d => ({
      id: d.id, tipo: d.tipo, marca: d.marca, modelo: d.modelo,
      serie: d.numero_serie, estadoFisico: d.estado_fisico,
      fallaCliente: d.falla_cliente, accesorios: d.accesorios || [],
      clienteNombre: d.cliente_nombre, clienteTel: d.cliente_tel,
      tecnico: (d.tecnico_display || '').trim() || 'Sin asignar',
      fecha: fmtDate(d.created_at), fechaTs: new Date(d.created_at).getTime()
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar dispositivos' });
  }
});

/**
 * POST /api/devices
 * Registra un dispositivo externo recibido para reparación y, en la misma
 * operación (`sp_CrearDispositivoConTicket`), crea el ticket de soporte
 * asociado con una descripción auto-generada a partir de los datos del equipo.
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Body: `{ tipo, marca, modelo?, serie?, estadoFisico?, fallaCliente, accesorios?: string[], clienteNombre, clienteTel?, tecnico? }`
 * - `estadoFisico`: uno de `'nuevo' | 'excelente' | 'bueno' | 'regular' | 'danado'`.
 * - `tecnico`: nombre completo o username del técnico a asignar (resuelto vía `db.findUserByNombre`).
 *
 * Respuesta 201: `{ device: <fila de dispositivos>, ticket: Ticket }`
 *
 * Códigos de estado:
 * - 201 — dispositivo y ticket creados.
 * - 400 — faltan campos requeridos, o `estadoFisico` no es válido.
 * - 403 — sin acceso al módulo.
 * - 500 — error al registrar.
 */
router.post('/devices', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const { tipo, marca, modelo, serie, estadoFisico, fallaCliente,
            accesorios, clienteNombre, clienteTel, tecnico } = req.body;

    if (!tipo || !marca || !clienteNombre || !fallaCliente)
      return res.status(400).json({ error: 'Tipo, marca, nombre del cliente y falla son requeridos' });
    if (estadoFisico && !CONDICIONES.includes(estadoFisico))
      return res.status(400).json({ error: 'Estado físico inválido' });

    const devId    = await db.nextId('dispositivos', 'DEV');
    const ticketId = await db.nextId('tickets', 'TK');

    let tecnicoId: number | null      = null;
    let tecnicoDisplay = 'Sin asignar';
    if (tecnico && tecnico !== 'Sin asignar') {
      const u = await db.findUserByNombre(tecnico);
      if (u) { tecnicoId = u.id; tecnicoDisplay = u.display.trim(); }
    }

    const estadoNombre = ({ excelente:'Excelente', bueno:'Bueno', regular:'Regular', danado:'Dañado' } as Record<string, string>)[estadoFisico] || estadoFisico;
    const serieText    = serie ? `\nN° de serie: ${serie}` : '';
    const accArr       = Array.isArray(accesorios) ? accesorios : [];
    const accText      = accArr.length ? `\n\nAccesorios entregados: ${accArr.join(', ')}` : '';
    const telText      = clienteTel ? ` · Tel: ${clienteTel}` : '';
    const desc = `Equipo recibido para diagnóstico y reparación.\n\nDispositivo: ${tipo} ${marca} ${modelo || ''}${serieText}\nEstado físico: ${estadoNombre}\n\nFalla reportada por el cliente:\n"${fallaCliente}"${accText}`;

    await db.exec('sp_CrearDispositivoConTicket', {
      dev_id: devId, ticket_id: ticketId, tipo, marca,
      modelo: modelo || '', numero_serie: serie || '',
      estado_fisico: estadoFisico || 'bueno', falla_cliente: fallaCliente,
      accesorios: JSON.stringify(accArr), cliente_nombre: clienteNombre,
      cliente_tel: clienteTel || '', tecnico_id: tecnicoId, tecnico_display: tecnicoDisplay,
      titulo: `Recepción: ${marca} ${modelo || tipo}`.trim(), descripcion: desc,
      reporter_nombre: `${clienteNombre}${telText}`
    });

    res.status(201).json({
      device: (await db.queryOne('SELECT * FROM dispositivos WHERE id = ?', [devId])),
      ticket: await loadTicket(ticketId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
});

/**
 * GET /api/inventory
 * Lista los equipos del inventario propio, con la cantidad prestada
 * calculada para los ítems de tipo `'cantidad'`.
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Respuesta 200: `Array<{ id, tipo, marca, modelo, serie, color, condicion, estado, tipoManejo, cantidadTotal, cantidadPrestada, ubicacion, responsable, foto, notas, garantia, fechaIngreso, fechaTs, historial: [] }>`
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar inventario.
 */
router.get('/inventory', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const items = await db.exec<any>('sp_GetInventory');
    const prestados = await db.query<any>(
      `SELECT inventario_id, SUM(cantidad - cantidad_devuelta) AS prestado
       FROM prestamos WHERE estado = 'activo' GROUP BY inventario_id`
    );
    const prestadoPorId: Record<string, number> = Object.fromEntries(prestados.map(p => [p.inventario_id, p.prestado]));

    res.json(items.map(i => ({
      id: i.id, tipo: i.tipo, marca: i.marca, modelo: i.modelo,
      serie: i.numero_serie, color: i.color,
      condicion: i.condicion, estado: i.estado,
      tipoManejo: i.tipo_manejo,
      cantidadTotal: i.cantidad_total,
      cantidadPrestada: i.tipo_manejo === 'cantidad' ? (prestadoPorId[i.id] || 0) : 0,
      ubicacion: i.ubicacion,
      responsable: (i.responsable_display || '').trim() || '',
      foto: i.foto || null,
      notas: i.notas, garantia: i.garantia ? JSON.parse(i.garantia) : null,
      fechaIngreso: i.fecha_ingreso ? fmtDate(i.fecha_ingreso) : fmtDate(i.created_at),
      fechaTs: new Date(i.created_at).getTime(),
      // Fecha de ingreso en formato YYYY-MM-DD (misma base local que fmtDate),
      // para el filtro por rango de fechas del panel de equipos.
      fechaIngresoISO: new Date(i.fecha_ingreso || i.created_at).toLocaleDateString('en-CA'),
      historial: []
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar inventario' });
  }
});

/**
 * POST /api/inventory
 * Registra un nuevo equipo o lote en el inventario. El modo de manejo
 * (`tipoManejo`) queda fijo desde la creación: `'unidad'` exige número de
 * serie; `'cantidad'` exige `cantidadTotal` (entero >= 1) y no lleva serie.
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Body: `{ tipo, marca, modelo?, serie?, color?, condicion?, estado?, ubicacion?, responsable?, notas?, garantia?, tipoManejo?: 'unidad'|'cantidad', cantidadTotal?, mobileToken? }`
 * - `condicion`: uno de `'nuevo' | 'excelente' | 'bueno' | 'regular' | 'danado'`.
 * - `mobileToken`: token de una sesión de subida de foto por QR (ver `resolveMobilePhoto`).
 *
 * Respuesta 201: el equipo creado, con `historial: []`.
 *
 * Códigos de estado:
 * - 201 — equipo registrado.
 * - 400 — faltan campos requeridos, o `condicion`/`tipoManejo` inválidos, o falta serie/cantidad según el modo.
 * - 403 — sin acceso al módulo.
 * - 500 — error al registrar.
 */
router.post('/inventory', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const { tipo, marca, modelo, serie, color, condicion, estado, ubicacion, responsable, notas, garantia,
            tipoManejo, cantidadTotal, mobileToken } = req.body;
    if (!tipo || !marca) return res.status(400).json({ error: 'Tipo y marca son requeridos' });
    if (condicion && !CONDICIONES.includes(condicion)) return res.status(400).json({ error: 'Condición inválida' });
    const estadoInicial = (estado && ESTADOS_INV.includes(estado) && estado !== 'en_prestamo') ? estado : 'disponible';

    const modo = tipoManejo || 'unidad';
    if (!TIPOS_MANEJO.includes(modo)) return res.status(400).json({ error: 'Tipo de manejo inválido' });

    let cantTotal: number | null = null;
    if (modo === 'unidad') {
      if (!serie || !serie.trim()) return res.status(400).json({ error: 'El número de serie es requerido' });
    } else {
      cantTotal = parseInt(cantidadTotal, 10);
      if (!Number.isInteger(cantTotal) || cantTotal < 1)
        return res.status(400).json({ error: 'La cantidad total debe ser un número entero mayor o igual a 1' });
    }

    const id = await db.nextId('inventario', 'INV');

    let responsableId: number | null = null;
    if (responsable) {
      const u = await db.findUserByNombre(responsable);
      if (u) responsableId = u.id;
    }

    const foto = resolveMobilePhoto(mobileToken);

    await db.query(
      `INSERT INTO inventario (id, tipo, marca, modelo, numero_serie, color, condicion,
                               estado, ubicacion, responsable_id, notas, garantia, foto, fecha_ingreso,
                               tipo_manejo, cantidad_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
      [id, tipo, marca, modelo || '', modo === 'unidad' ? serie : '', color || '',
       condicion || 'bueno', estadoInicial, ubicacion || '', responsableId,
       notas || '', garantia ? JSON.stringify(garantia) : null, foto, modo, cantTotal]
    );

    await db.query(
      'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
      [id, modo === 'cantidad' ? `Lote registrado en inventario (${cantTotal} unidades)` : 'Equipo registrado en inventario']
    );
    await logAudit(req.user!.nombre, 'Agregó equipo al inventario', 'inventario', id,
      `${id}: ${tipo} ${marca}${modelo ? ' ' + modelo : ''}`);

    res.status(201).json({ id, tipo, marca, modelo, serie: modo === 'unidad' ? serie : '', color, condicion,
      estado: estadoInicial, tipoManejo: modo, cantidadTotal: cantTotal, cantidadPrestada: 0,
      ubicacion, responsable, foto, notas, garantia, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar equipo' });
  }
});

/**
 * PATCH /api/inventory/:id
 * Actualiza uno o más campos de un equipo del inventario (edición parcial).
 * No permite cambiar el `estado` mientras el equipo está `'en_prestamo'`
 * (debe gestionarse desde la devolución del préstamo). Cada cambio de
 * `estado` queda registrado en `historial_inventario`.
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Parámetros de ruta: `id` — id del equipo (ej. `INV-001`).
 *
 * Body (todos opcionales, se aplican solo los presentes): `{ tipo?, marca?, modelo?, serie?, color?, condicion?, estado?, ubicacion?, notas?, garantia?, cantidadTotal?, responsable?, mobileToken? }`
 * - Si es tipo `'cantidad'`, `cantidadTotal` no puede bajar por debajo de lo ya prestado.
 *
 * Respuesta 200: el equipo actualizado, con `historial: []`.
 *
 * Códigos de estado:
 * - 200 — actualizado correctamente.
 * - 400 — algún valor no es válido (condición, estado, serie vacía, cantidad no entera).
 * - 403 — sin acceso al módulo.
 * - 404 — el equipo no existe.
 * - 409 — se intentó cambiar el estado de un equipo prestado, o bajar `cantidadTotal` por debajo de lo prestado.
 * - 500 — error al actualizar.
 */
router.patch('/inventory/:id', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const id   = req.params.id;
    const item = await db.queryOne<any>('SELECT * FROM inventario WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    if (item.estado === 'en_prestamo' && req.body.estado !== undefined && req.body.estado !== 'en_prestamo')
      return res.status(409).json({ error: 'El equipo está prestado. Gestiona la devolución desde la sección Préstamos.' });

    if (req.body.condicion !== undefined && !CONDICIONES.includes(req.body.condicion))
      return res.status(400).json({ error: 'Condición inválida' });
    if (req.body.estado !== undefined && !ESTADOS_INV.includes(req.body.estado))
      return res.status(400).json({ error: 'Estado inválido' });
    if (item.tipo_manejo === 'unidad' && req.body.serie !== undefined && !req.body.serie.trim())
      return res.status(400).json({ error: 'El número de serie es requerido' });

    let nuevaCantTotal: number | null = null;
    if (item.tipo_manejo === 'cantidad' && req.body.cantidadTotal !== undefined) {
      nuevaCantTotal = parseInt(req.body.cantidadTotal, 10);
      if (!Number.isInteger(nuevaCantTotal) || nuevaCantTotal < 1)
        return res.status(400).json({ error: 'La cantidad total debe ser un número entero mayor o igual a 1' });
      const prestado = await getCantidadPrestada(id);
      if (nuevaCantTotal < prestado)
        return res.status(409).json({ error: `No se puede bajar de ${prestado} unidades: hay préstamos activos por esa cantidad.` });
    }

    const ESTADO_NAMES: Record<string, string> = { disponible:'Disponible', en_uso:'En uso', en_prestamo:'En préstamo',
                           en_reparacion:'En reparación', de_baja:'De baja' };

    const campos = ['tipo','marca','modelo','numero_serie','color','condicion','estado','ubicacion','notas','garantia'];
    const sets: string[]   = [];
    const vals: any[]   = [];

    for (const campo of campos) {
      const key = campo === 'numero_serie' ? 'serie' : campo;
      if (item.tipo_manejo === 'cantidad' && key === 'serie') continue;
      if (req.body[key] !== undefined) {
        sets.push(`${campo} = ?`);
        vals.push(campo === 'garantia'
          ? (req.body[key] ? JSON.stringify(req.body[key]) : null)
          : req.body[key]);

        if (campo === 'estado' && req.body[key] !== item.estado) {
          await db.query(
            'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
            [id, `Estado cambiado a "${ESTADO_NAMES[req.body[key]] || req.body[key]}"`]
          );
        }
      }
    }

    if (nuevaCantTotal !== null) {
      sets.push('cantidad_total = ?');
      vals.push(nuevaCantTotal);
    }

    if (req.body.responsable !== undefined) {
      let rid: number | null = null;
      if (req.body.responsable) {
        const u = await db.findUserByNombre(req.body.responsable);
        if (u) rid = u.id;
      }
      sets.push('responsable_id = ?');
      vals.push(rid);
    }

    const nuevaFoto = resolveMobilePhoto(req.body.mobileToken);
    if (nuevaFoto) {
      sets.push('foto = ?');
      vals.push(nuevaFoto);
    }

    if (sets.length) {
      vals.push(id);
      await db.query(`UPDATE inventario SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
      await logAudit(req.user!.nombre, 'Editó equipo del inventario', 'inventario', id,
        `${id}: campos modificados — ${sets.map(s => s.split(' =')[0]).join(', ')}`);
    }

    const updated = await db.queryOne<any>('SELECT * FROM inventario WHERE id = ?', [id]);
    res.json({ ...updated, garantia: updated.garantia ? JSON.parse(updated.garantia) : null, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar equipo' });
  }
});

/**
 * DELETE /api/inventory/:id
 * Elimina un equipo del inventario junto con su historial y sus préstamos.
 * No permite eliminar un equipo con un préstamo activo.
 *
 * Auth: superadmin, o acceso al módulo `'inventario'`.
 *
 * Parámetros de ruta: `id` — id del equipo.
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — eliminado correctamente.
 * - 403 — sin acceso al módulo.
 * - 409 — el equipo tiene un préstamo activo.
 * - 500 — error al eliminar.
 */
router.delete('/inventory/:id', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const activeLoan = await db.queryOne(
      "SELECT id FROM prestamos WHERE inventario_id = ? AND estado = 'activo'", [id]
    );
    if (activeLoan)
      return res.status(409).json({ error: 'No se puede eliminar un equipo con préstamo activo. Registra la devolución primero.' });

    const inv = await db.queryOne<any>('SELECT tipo, marca, modelo FROM inventario WHERE id = ?', [id]);

    await db.query('DELETE FROM historial_inventario WHERE inventario_id = ?', [id]);
    await db.query('DELETE FROM prestamos WHERE inventario_id = ?', [id]);
    await db.query('DELETE FROM inventario WHERE id = ?', [id]);

    await logAudit(req.user!.nombre, 'Eliminó equipo del inventario', 'inventario', id,
      inv ? `${id}: ${inv.tipo} ${inv.marca} ${inv.modelo || ''}`.trim() : id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

/**
 * GET /api/loans
 * Lista todos los préstamos de equipo/inventario.
 *
 * Auth: superadmin, o acceso al módulo `'prestamos'`.
 *
 * Respuesta 200: `Array<{ id, inventoryId, empleado, departamento, fechaPrestamo, fechaPrestamoTs, fechaDevolucionEstimada, fechaDevolucionReal, estado, cantidad, cantidadDevuelta, autorizadoPor, notas, condicionDevolucion, notaDevolucion, equipoDesc }>`
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar préstamos.
 */
router.get('/loans', ...requireSuperadminOrAcceso('prestamos'), async (req: Request, res: Response) => {
  try {
    const loans = await db.exec<any>('sp_GetLoans');
    res.json(loans.map(l => ({
      id: l.id,
      inventoryId: l.inventario_id,
      empleado: l.empleado_display?.trim() || l.empleado_nombre || '',
      departamento: l.departamento,
      fechaPrestamo: fmtDate(l.fecha_prestamo),
      fechaPrestamoTs: new Date(l.fecha_prestamo).getTime(),
      // Fecha del préstamo en YYYY-MM-DD (misma base local que fmtDate), para el filtro por rango de fechas.
      fechaPrestamoISO: new Date(l.fecha_prestamo).toLocaleDateString('en-CA'),
      fechaDevolucionEstimada: l.fecha_devolucion_estimada ? fmtDate(l.fecha_devolucion_estimada) : '',
      // Misma fecha en YYYY-MM-DD, para prellenar el input date al editar.
      fechaDevolucionEstimadaISO: l.fecha_devolucion_estimada ? new Date(l.fecha_devolucion_estimada).toLocaleDateString('en-CA') : '',
      fechaDevolucionReal: l.fecha_devolucion_real ? fmtDate(l.fecha_devolucion_real) : null,
      estado: l.estado,
      cantidad: l.cantidad,
      cantidadDevuelta: l.cantidad_devuelta,
      autorizadoPor: (l.autorizado_display || '').trim() || '',
      notas: l.notas,
      condicionDevolucion: l.condicion_devolucion || null,
      notaDevolucion: l.nota_devolucion || null,
      fotosEntrega: l.fotos_entrega ? JSON.parse(l.fotos_entrega) : [],
      equipoDesc: l.equipoDesc,
      grupoId: l.grupo_id || null,
      permanente: !!l.permanente
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar préstamos' });
  }
});

/**
 * POST /api/loans
 * Registra un préstamo de un equipo/lote de inventario a un empleado. En
 * modo `'unidad'`, marca el equipo como `'en_prestamo'` y rechaza el
 * préstamo si ya está prestado; en modo `'cantidad'`, valida que haya
 * suficiente stock disponible (`cantidadTotal - getCantidadPrestada`).
 *
 * Auth: superadmin, o acceso al módulo `'prestamos'`.
 *
 * Body: `{ empleado, departamento?, fechaDevolucion?, autorizadoPorId?, notas?, mobileTokens?, items?: [{ inventoryId, cantidad }] }`
 * - `items`: uno o varios equipos a prestar juntos a la misma persona. Si hay
 *   más de uno, se crea un préstamo por equipo con un `grupo_id` compartido
 *   (para el comprobante único). Compatibilidad: si no se envía `items`, se
 *   aceptan `inventoryId`/`cantidad` sueltos (un solo equipo, `grupo_id` NULL).
 * - `empleado`: nombre completo o username (resuelto vía `db.findUserByNombre`).
 * - `cantidad`: por equipo, requerida y validada solo si el equipo es de tipo `'cantidad'`.
 * - `mobileTokens`: tokens de subida por QR (ver `resolveMobilePhotos`); sus fotos se guardan como `fotos_entrega` en el primer préstamo del grupo.
 *
 * Respuesta 201: `{ loans: <filas de préstamos creadas>, grupoId: string | null }`
 *
 * Códigos de estado:
 * - 201 — préstamo registrado.
 * - 400 — faltan `inventoryId`/`empleado`, o `cantidad` inválida.
 * - 403 — sin acceso al módulo.
 * - 404 — el equipo no existe en inventario.
 * - 409 — el equipo (modo `'unidad'`) ya está prestado, o no hay stock suficiente (modo `'cantidad'`).
 * - 500 — error al registrar el préstamo.
 */
router.post('/loans', ...requireSuperadminOrAcceso('prestamos'), async (req: Request, res: Response) => {
  try {
    const { empleado, departamento, fechaDevolucion, autorizadoPorId, notas, mobileTokens } = req.body;
    // Compatibilidad: acepta un solo equipo (inventoryId/cantidad, flujo
    // anterior) o un arreglo `items = [{ inventoryId, cantidad }]` para
    // prestar varios equipos distintos a la misma persona en una operación.
    const rawItems: any[] = Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items
      : [{ inventoryId: req.body.inventoryId, cantidad: req.body.cantidad }];

    if (!empleado) return res.status(400).json({ error: 'empleado es requerido' });
    if (!rawItems.every((it: any) => it && it.inventoryId))
      return res.status(400).json({ error: 'Cada equipo requiere inventoryId' });

    // Cargar y validar TODOS los equipos antes de crear nada, para no dejar un
    // préstamo a medias si alguno no está disponible.
    const preparados: { item: any; cantSolicitada: number }[] = [];
    for (const it of rawItems) {
      const item = await db.queryOne<any>('SELECT * FROM inventario WHERE id = ?', [it.inventoryId]);
      if (!item) return res.status(404).json({ error: `Equipo ${it.inventoryId} no encontrado en inventario` });

      let cantSolicitada = 1;
      if (item.tipo_manejo === 'unidad') {
        if (item.estado === 'en_prestamo')
          return res.status(409).json({ error: `El equipo ${item.marca} ${item.modelo || item.tipo} ya está prestado` });
      } else {
        cantSolicitada = parseInt(it.cantidad, 10);
        if (!Number.isInteger(cantSolicitada) || cantSolicitada < 1)
          return res.status(400).json({ error: 'La cantidad a prestar debe ser un número entero mayor o igual a 1' });
        const prestado   = await getCantidadPrestada(it.inventoryId);
        const disponible = (item.cantidad_total || 0) - prestado;
        if (cantSolicitada > disponible)
          return res.status(409).json({ error: `Solo hay ${disponible} unidades disponibles de ${item.marca} ${item.modelo || item.tipo}` });
      }
      preparados.push({ item, cantSolicitada });
    }

    let empleadoId: number | null = null;
    const u = await db.findUserByNombre(empleado);
    if (u) empleadoId = u.id;
    const autorizadoId = autorizadoPorId ? parseInt(autorizadoPorId, 10) || null : null;

    // Asignación permanente: sin fecha de devolución esperada.
    const permanente = req.body.permanente ? 1 : 0;
    const fechaDev = permanente ? null : (fechaDevolucion || null);

    const fotosEntrega = resolveMobilePhotos(mobileTokens);
    const fotosJson = fotosEntrega.length ? JSON.stringify(fotosEntrega) : null;

    // grupo_id solo cuando hay más de un equipo; un solo equipo mantiene el
    // comportamiento anterior (grupo_id NULL).
    const grupoId = preparados.length > 1 ? await db.nextId('grupos', 'GRP') : null;

    const createdIds: string[] = [];
    for (let idx = 0; idx < preparados.length; idx++) {
      const { item, cantSolicitada } = preparados[idx];
      const id = await db.nextId('prestamos', 'PREST');
      // Las fotos de entrega se guardan una sola vez, en el primer préstamo del grupo.
      const fotosParaEste = idx === 0 ? fotosJson : null;
      await db.query(
        `INSERT INTO prestamos (id, inventario_id, empleado_id, empleado_nombre, departamento,
                                fecha_prestamo, fecha_devolucion_estimada, estado, autorizado_por_id, notas, cantidad, fotos_entrega, grupo_id, permanente)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, 'activo', ?, ?, ?, ?, ?, ?)`,
        [id, item.id, empleadoId, empleado, departamento || '',
         fechaDev, autorizadoId, notas || '', cantSolicitada, fotosParaEste, grupoId, permanente]
      );

      if (item.tipo_manejo === 'unidad') {
        await db.query(
          `UPDATE inventario SET estado = 'en_prestamo', responsable_id = ?, updated_at = NOW() WHERE id = ?`,
          [empleadoId, item.id]
        );
      }

      await db.query(
        'INSERT INTO historial_inventario (inventario_id, usuario_id, accion) VALUES (?, ?, ?)',
        [item.id, empleadoId,
         item.tipo_manejo === 'cantidad' ? `Préstamo ${id} — ${cantSolicitada} unidades a ${empleado}` : `Préstamo ${id} — ${empleado}`]
      );
      createdIds.push(id);
    }

    await logAudit(req.user!.nombre,
      'Registró préstamo', 'prestamo', grupoId || createdIds[0],
      `${grupoId ? `${grupoId} (${createdIds.length} equipos)` : `${createdIds[0]}: ${preparados[0].item.id}`} → ${empleado}${departamento ? ' (' + departamento + ')' : ''}`);

    const loans = await db.query(
      `SELECT * FROM prestamos WHERE id IN (${createdIds.map(() => '?').join(',')})`, createdIds);
    res.status(201).json({ loans, grupoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
  }
});

/**
 * PATCH /api/loans/:id
 * Gestiona la devolución (total o parcial) de un préstamo, y/o actualiza
 * sus notas. Dos formas de indicar devolución (mutuamente compatibles, ver
 * cuerpo): `estado: 'devuelto'` devuelve todo lo pendiente de una vez;
 * `cantidadDevuelta` permite devolución parcial (ej. devolver 1 de 2
 * unidades prestadas de un lote). Si el equipo es de tipo `'unidad'` y la
 * devolución queda completa, el equipo pasa a `'disponible'`, o a
 * `'en_reparacion'` si `condicionDevolucion` es `'danado'`.
 *
 * Auth: superadmin, o acceso al módulo `'prestamos'`.
 *
 * Parámetros de ruta: `id` — id del préstamo (ej. `PREST-001`).
 *
 * Body: `{ estado?: 'devuelto', cantidadDevuelta?: number, condicionDevolucion?, notaDevolucion?, notas? }`
 * - `condicionDevolucion`: uno de `'nuevo' | 'excelente' | 'bueno' | 'regular' | 'danado'`.
 *
 * Respuesta 200: la fila de `prestamos` actualizada.
 *
 * Códigos de estado:
 * - 200 — actualizado correctamente.
 * - 400 — `cantidadDevuelta` inválida, o mayor a lo restante por devolver, o `condicionDevolucion` inválida.
 * - 403 — sin acceso al módulo.
 * - 404 — el préstamo no existe.
 * - 409 — el préstamo ya fue devuelto por completo.
 * - 500 — error al actualizar.
 */
router.patch('/loans/:id', ...requireSuperadminOrAcceso('prestamos'), async (req: Request, res: Response) => {
  try {
    const id   = req.params.id;
    const loan = await db.queryOne<any>('SELECT * FROM prestamos WHERE id = ?', [id]);
    if (!loan) return res.status(404).json({ error: 'Préstamo no encontrado' });

    const restante = loan.cantidad - loan.cantidad_devuelta;

    // `estado: 'devuelto'` (flujo anterior, un solo clic) devuelve todo lo
    // pendiente. `cantidadDevuelta` permite devolución parcial (artículos
    // por cantidad, ej. devolver 1 de 2 mouse prestados).
    let cantidadARegistrar: number | null = null;
    if (req.body.cantidadDevuelta !== undefined) {
      cantidadARegistrar = parseInt(req.body.cantidadDevuelta, 10);
      if (!Number.isInteger(cantidadARegistrar) || cantidadARegistrar < 1)
        return res.status(400).json({ error: 'La cantidad a devolver debe ser un número entero mayor o igual a 1' });
    } else if (req.body.estado === 'devuelto') {
      cantidadARegistrar = restante;
    }

    if (cantidadARegistrar !== null) {
      if (loan.estado === 'devuelto')
        return res.status(409).json({ error: 'Este préstamo ya fue devuelto por completo' });
      if (cantidadARegistrar > restante)
        return res.status(400).json({ error: `Solo quedan ${restante} unidades pendientes de devolver en este préstamo` });

      if (req.body.condicionDevolucion !== undefined && !CONDICIONES.includes(req.body.condicionDevolucion))
        return res.status(400).json({ error: 'Condición de devolución inválida' });

      const nuevaDevuelta = loan.cantidad_devuelta + cantidadARegistrar;
      const nuevoEstado   = nuevaDevuelta >= loan.cantidad ? 'devuelto' : 'activo';

      await db.query(
        `UPDATE prestamos SET cantidad_devuelta = ?, estado = ?,
                              fecha_devolucion_real = ${nuevoEstado === 'devuelto' ? 'NOW()' : 'fecha_devolucion_real'},
                              condicion_devolucion = COALESCE(?, condicion_devolucion),
                              nota_devolucion = COALESCE(?, nota_devolucion)
         WHERE id = ?`,
        [nuevaDevuelta, nuevoEstado, req.body.condicionDevolucion || null, req.body.notaDevolucion || null, id]
      );

      // La condición reportada al devolver no solo queda impresa en el
      // comprobante — alimenta la ficha real del equipo. Si vuelve "dañado",
      // se manda a 'en_reparacion' en vez de 'disponible' para que nadie lo
      // vuelva a prestar sin revisarlo primero. Solo aplica a modo 'unidad':
      // en modo 'cantidad' el estado del ítem no representa disponibilidad
      // (ver getCantidadPrestada) y una sola condición no describe N unidades.
      const item = await db.queryOne<any>('SELECT tipo_manejo FROM inventario WHERE id = ?', [loan.inventario_id]);
      let nuevoEstadoInv: string | null = null;
      if (item?.tipo_manejo === 'unidad' && nuevoEstado === 'devuelto') {
        const condDev = req.body.condicionDevolucion as string | undefined;
        nuevoEstadoInv = condDev === 'danado' ? 'en_reparacion' : 'disponible';
        await db.query(
          `UPDATE inventario SET estado = ?, condicion = COALESCE(?, condicion), updated_at = NOW()
           WHERE id = ? AND estado = 'en_prestamo'`,
          [nuevoEstadoInv, condDev || null, loan.inventario_id]
        );
      }

      await db.query(
        'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
        [loan.inventario_id, item?.tipo_manejo === 'cantidad'
          ? `Devolución de ${cantidadARegistrar} unidades de ${loan.empleado_nombre} (${id})${nuevoEstado === 'activo' ? ` — quedan ${loan.cantidad - nuevaDevuelta} pendientes` : ''}`
          : `Devolución de ${loan.empleado_nombre} (${id})${nuevoEstadoInv === 'en_reparacion' ? ' — regresó dañado, enviado a reparación' : ''}`]
      );
      await logAudit(req.user!.nombre,
        'Registró devolución de préstamo', 'prestamo', id,
        `${id}: ${loan.inventario_id} devuelto por ${loan.empleado_nombre}${item?.tipo_manejo === 'cantidad' ? ` (${cantidadARegistrar} uds.)` : ''}`);
    }

    // Edición de los datos del préstamo (independiente de la devolución):
    // empleado, departamento, fecha estimada, autorizado por, notas y si es
    // una asignación permanente. Se arma un UPDATE dinámico con lo enviado.
    const sets: string[] = [];
    const params: any[] = [];
    if (req.body.empleado !== undefined) {
      const eu = await db.findUserByNombre(req.body.empleado);
      sets.push('empleado_nombre = ?', 'empleado_id = ?');
      params.push(req.body.empleado, eu ? eu.id : null);
    }
    if (req.body.departamento !== undefined) { sets.push('departamento = ?'); params.push(req.body.departamento || ''); }
    if (req.body.autorizadoPorId !== undefined) {
      sets.push('autorizado_por_id = ?');
      params.push(req.body.autorizadoPorId ? parseInt(req.body.autorizadoPorId, 10) || null : null);
    }
    if (req.body.notas !== undefined) { sets.push('notas = ?'); params.push(req.body.notas); }
    if (req.body.permanente !== undefined) {
      const perm = req.body.permanente ? 1 : 0;
      sets.push('permanente = ?'); params.push(perm);
      // Permanente = sin fecha de devolución esperada.
      sets.push('fecha_devolucion_estimada = ?');
      params.push(perm ? null : (req.body.fechaDevolucion || null));
    } else if (req.body.fechaDevolucion !== undefined) {
      sets.push('fecha_devolucion_estimada = ?');
      params.push(req.body.fechaDevolucion || null);
    }
    if (sets.length) {
      params.push(id);
      await db.query(`UPDATE prestamos SET ${sets.join(', ')} WHERE id = ?`, params);
      await logAudit(req.user!.nombre, 'Editó préstamo', 'prestamo', id, `${id} — datos actualizados`);
    }

    res.json(await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar préstamo' });
  }
});

/**
 * GET /api/auditoria
 * Consulta la bitácora de auditoría del sistema (acciones administrativas
 * registradas vía `logAudit`), con filtros opcionales.
 *
 * Auth: superadmin, o acceso al módulo `'bitacora'`.
 *
 * Query: `{ actor?, entidad?, desde?, hasta?, limit? }`
 * - `limit`: máximo de filas a retornar, tope 500 (default 200).
 *
 * Respuesta 200: filas de `sp_GetAuditoria`.
 *
 * Códigos de estado:
 * - 200 — resultados cargados.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar la auditoría.
 */
router.get('/auditoria', ...requireSuperadminOrAcceso('bitacora'), async (req: Request, res: Response) => {
  try {
    const { actor, entidad, desde, hasta } = req.query;
    const limit = Math.min(parseInt((req.query.limit as string)) || 200, 500);

    const rows = await db.exec('sp_GetAuditoria', {
      actor:   actor   || null,
      entidad: entidad || null,
      desde:   desde   || null,
      hasta:   hasta   || null,
      limit
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar auditoría' });
  }
});

export default router;
