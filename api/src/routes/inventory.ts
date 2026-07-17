import express, { Request, Response } from 'express';
import db from '../db';
import { fmtDate, logAudit } from '../helpers';
import { loadTicket } from '../ticketLoader';
import { requireSuperadminOrAcceso } from '../middleware/auth';

const router = express.Router();

const CONDICIONES   = ['nuevo', 'excelente', 'bueno', 'regular', 'danado'];
const ESTADOS_INV   = ['disponible', 'en_uso', 'en_prestamo', 'en_reparacion', 'de_baja'];
const TIPOS_MANEJO  = ['unidad', 'cantidad'];

// Cuánto de un ítem 'cantidad' está prestado ahora mismo (préstamos activos,
// descontando lo ya devuelto parcialmente).
async function getCantidadPrestada(inventarioId: string): Promise<number> {
  const row = await db.queryOne<any>(
    `SELECT ISNULL(SUM(cantidad - cantidad_devuelta), 0) AS prestado
     FROM prestamos WHERE inventario_id = ? AND estado = 'activo'`,
    [inventarioId]
  );
  return row?.prestado || 0;
}

// GET /api/devices
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

// POST /api/devices
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

// GET /api/inventory
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
      notas: i.notas, garantia: i.garantia ? JSON.parse(i.garantia) : null,
      fechaIngreso: i.fecha_ingreso ? fmtDate(i.fecha_ingreso) : fmtDate(i.created_at),
      fechaTs: new Date(i.created_at).getTime(),
      historial: []
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar inventario' });
  }
});

// POST /api/inventory
router.post('/inventory', ...requireSuperadminOrAcceso('inventario'), async (req: Request, res: Response) => {
  try {
    const { tipo, marca, modelo, serie, color, condicion, estado, ubicacion, responsable, notas, garantia,
            tipoManejo, cantidadTotal } = req.body;
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

    await db.query(
      `INSERT INTO inventario (id, tipo, marca, modelo, numero_serie, color, condicion,
                               estado, ubicacion, responsable_id, notas, garantia, fecha_ingreso,
                               tipo_manejo, cantidad_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
      [id, tipo, marca, modelo || '', modo === 'unidad' ? serie : '', color || '',
       condicion || 'bueno', estadoInicial, ubicacion || '', responsableId,
       notas || '', garantia ? JSON.stringify(garantia) : null, modo, cantTotal]
    );

    await db.query(
      'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
      [id, modo === 'cantidad' ? `Lote registrado en inventario (${cantTotal} unidades)` : 'Equipo registrado en inventario']
    );
    await logAudit(req.user!.nombre, 'Agregó equipo al inventario', 'inventario', id,
      `${id}: ${tipo} ${marca}${modelo ? ' ' + modelo : ''}`);

    res.status(201).json({ id, tipo, marca, modelo, serie: modo === 'unidad' ? serie : '', color, condicion,
      estado: estadoInicial, tipoManejo: modo, cantidadTotal: cantTotal, cantidadPrestada: 0,
      ubicacion, responsable, notas, garantia, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar equipo' });
  }
});

// PATCH /api/inventory/:id
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

// DELETE /api/inventory/:id
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

// GET /api/loans
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
      fechaDevolucionEstimada: l.fecha_devolucion_estimada ? fmtDate(l.fecha_devolucion_estimada) : '',
      fechaDevolucionReal: l.fecha_devolucion_real ? fmtDate(l.fecha_devolucion_real) : null,
      estado: l.estado,
      cantidad: l.cantidad,
      cantidadDevuelta: l.cantidad_devuelta,
      autorizadoPor: (l.autorizado_display || '').trim() || '',
      notas: l.notas,
      equipoDesc: l.equipoDesc
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar préstamos' });
  }
});

// POST /api/loans
router.post('/loans', ...requireSuperadminOrAcceso('prestamos'), async (req: Request, res: Response) => {
  try {
    const { inventoryId, empleado, departamento, fechaDevolucion, autorizadoPorId, notas, cantidad } = req.body;
    if (!inventoryId || !empleado)
      return res.status(400).json({ error: 'inventoryId y empleado son requeridos' });

    const item = await db.queryOne<any>('SELECT * FROM inventario WHERE id = ?', [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Equipo no encontrado en inventario' });

    let cantSolicitada = 1;
    if (item.tipo_manejo === 'unidad') {
      if (item.estado === 'en_prestamo') return res.status(409).json({ error: 'El equipo ya está prestado' });
    } else {
      cantSolicitada = parseInt(cantidad, 10);
      if (!Number.isInteger(cantSolicitada) || cantSolicitada < 1)
        return res.status(400).json({ error: 'La cantidad a prestar debe ser un número entero mayor o igual a 1' });
      const prestado    = await getCantidadPrestada(inventoryId);
      const disponible  = (item.cantidad_total || 0) - prestado;
      if (cantSolicitada > disponible)
        return res.status(409).json({ error: `Solo hay ${disponible} unidades disponibles de este artículo` });
    }

    const id = await db.nextId('prestamos', 'PREST');

    let empleadoId: number | null = null;
    const u = await db.findUserByNombre(empleado);
    if (u) empleadoId = u.id;

    const autorizadoId = autorizadoPorId ? parseInt(autorizadoPorId, 10) || null : null;

    await db.query(
      `INSERT INTO prestamos (id, inventario_id, empleado_id, empleado_nombre, departamento,
                              fecha_prestamo, fecha_devolucion_estimada, estado, autorizado_por_id, notas, cantidad)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 'activo', ?, ?, ?)`,
      [id, inventoryId, empleadoId, empleado, departamento || '',
       fechaDevolucion || null, autorizadoId, notas || '', cantSolicitada]
    );

    if (item.tipo_manejo === 'unidad') {
      await db.query(
        `UPDATE inventario SET estado = 'en_prestamo', responsable_id = ?, updated_at = NOW() WHERE id = ?`,
        [empleadoId, inventoryId]
      );
    }

    await db.query(
      'INSERT INTO historial_inventario (inventario_id, usuario_id, accion) VALUES (?, ?, ?)',
      [inventoryId, empleadoId,
       item.tipo_manejo === 'cantidad' ? `Préstamo ${id} — ${cantSolicitada} unidades a ${empleado}` : `Préstamo ${id} — ${empleado}`]
    );

    const loan = await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]);
    const inv  = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [inventoryId]);
    await logAudit(req.user!.nombre,
      'Registró préstamo', 'prestamo', id,
      `${id}: ${inventoryId} → ${empleado}${departamento ? ' (' + departamento + ')' : ''}${item.tipo_manejo === 'cantidad' ? ` (${cantSolicitada} uds.)` : ''}`);
    res.status(201).json({ loan, item: inv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
  }
});

// PATCH /api/loans/:id
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

      const nuevaDevuelta = loan.cantidad_devuelta + cantidadARegistrar;
      const nuevoEstado   = nuevaDevuelta >= loan.cantidad ? 'devuelto' : 'activo';

      await db.query(
        `UPDATE prestamos SET cantidad_devuelta = ?, estado = ?,
                              fecha_devolucion_real = ${nuevoEstado === 'devuelto' ? 'NOW()' : 'fecha_devolucion_real'}
         WHERE id = ?`,
        [nuevaDevuelta, nuevoEstado, id]
      );

      const item = await db.queryOne<any>('SELECT tipo_manejo FROM inventario WHERE id = ?', [loan.inventario_id]);
      if (item?.tipo_manejo === 'unidad' && nuevoEstado === 'devuelto') {
        await db.query(
          `UPDATE inventario SET estado = 'disponible', updated_at = NOW() WHERE id = ? AND estado = 'en_prestamo'`,
          [loan.inventario_id]
        );
      }

      await db.query(
        'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
        [loan.inventario_id, item?.tipo_manejo === 'cantidad'
          ? `Devolución de ${cantidadARegistrar} unidades de ${loan.empleado_nombre} (${id})${nuevoEstado === 'activo' ? ` — quedan ${loan.cantidad - nuevaDevuelta} pendientes` : ''}`
          : `Devolución de ${loan.empleado_nombre} (${id})`]
      );
      await logAudit(req.user!.nombre,
        'Registró devolución de préstamo', 'prestamo', id,
        `${id}: ${loan.inventario_id} devuelto por ${loan.empleado_nombre}${item?.tipo_manejo === 'cantidad' ? ` (${cantidadARegistrar} uds.)` : ''}`);
    }

    if (req.body.notas !== undefined)
      await db.query('UPDATE prestamos SET notas = ? WHERE id = ?', [req.body.notas, id]);

    res.json(await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar préstamo' });
  }
});

// GET /api/auditoria
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
