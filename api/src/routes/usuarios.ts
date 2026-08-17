/**
 * Gestión de usuarios: listado con datos personales, activar/desactivar,
 * eliminar, cambio de contraseña (solo superadmin), permisos de módulo
 * (solo superadmin), altas de técnicos/admins ("admins") y aprobación o
 * rechazo de solicitudes de registro de empleados.
 * Montado en `server.ts` bajo el prefijo `/api` (rutas ya incluyen su propio
 * segmento, ej. `/usuarios`, `/admins`, `/solicitudes`).
 */
import express, { Request, Response } from 'express';
import db from '../db';
import { logAudit } from '../helpers';
import { requireRole, requireSuperadminOrAcceso } from '../middleware/auth';

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * GET /api/usuarios
 * Lista todos los usuarios con sus datos personales (correo, teléfono,
 * finca, área). Ver este listado requiere ser superadmin o tener el módulo
 * `usuarios` otorgado explícitamente.
 *
 * Auth: superadmin, o acceso al módulo `'usuarios'`.
 *
 * Respuesta 200: filas de `sp_GetUsuarios`.
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar usuarios.
 */
router.get('/usuarios', ...requireSuperadminOrAcceso('usuarios'), async (req: Request, res: Response) => {
  try {
    res.json(await db.exec('sp_GetUsuarios'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

/**
 * GET /api/usuarios/:id/tickets
 * Lista los tickets reportados por un usuario específico (usado desde el
 * detalle de usuario en el panel admin).
 *
 * Auth: superadmin, o acceso al módulo `'usuarios'`.
 *
 * Parámetros de ruta: `id` — id numérico del usuario.
 *
 * Respuesta 200: `{ nombre: string, tickets: Array<{ id, titulo, status, prioridad, categoria, created_at }> }`
 *
 * Códigos de estado:
 * - 200 — cargado correctamente.
 * - 403 — sin acceso al módulo.
 * - 404 — el usuario no existe.
 * - 500 — error al cargar los tickets.
 */
router.get('/usuarios/:id/tickets', ...requireSuperadminOrAcceso('usuarios'), async (req: Request, res: Response) => {
  try {
    const user = await db.queryOne<any>('SELECT nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const nombre  = `${user.nombre} ${user.apellido || ''}`.trim();
    const tickets = await db.query(
      `SELECT id, titulo, status, prioridad, categoria, created_at
       FROM tickets WHERE reporter_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ nombre, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets del usuario' });
  }
});

/**
 * DELETE /api/usuarios/:id
 * Elimina un usuario definitivamente. Antes de borrarlo, desvincula (deja en
 * `NULL`) todas las referencias a su id en tickets, comentarios, historial,
 * inventario, préstamos y dispositivos, para no dejar foreign keys colgando;
 * marca sus solicitudes de registro como `'eliminado'`. Un usuario no puede
 * eliminar su propia cuenta.
 *
 * Auth: requiere `rol_nivel >= 3`.
 *
 * Parámetros de ruta: `id` — id numérico del usuario a eliminar.
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — eliminado correctamente.
 * - 400 — se intentó eliminar la propia cuenta.
 * - 403 — el usuario autenticado no tiene rol suficiente.
 * - 404 — el usuario objetivo no existe.
 * - 500 — error al eliminar.
 */
router.delete('/usuarios/:id', ...requireRole(3), async (req: Request, res: Response) => {
  try {
    if (String(req.user!.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const target = await db.queryOne<any>('SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Toda la desvinculación de referencias + el DELETE van en una transacción:
    // si algo falla a mitad, no queda un usuario parcialmente desvinculado y sin
    // borrar (estado inconsistente de integridad referencial).
    await db.withTransaction(async (tx) => {
      await tx.query('UPDATE tickets      SET asignado_id       = NULL WHERE asignado_id      = ?', [req.params.id]);
      await tx.query('UPDATE tickets      SET reporter_id       = NULL WHERE reporter_id      = ?', [req.params.id]);
      await tx.query('UPDATE comentarios  SET autor_id          = NULL WHERE autor_id         = ?', [req.params.id]);
      await tx.query('UPDATE historial_tickets SET usuario_id   = NULL WHERE usuario_id       = ?', [req.params.id]);
      await tx.query('UPDATE dispositivos SET tecnico_id        = NULL WHERE tecnico_id        = ?', [req.params.id]);
      await tx.query('UPDATE inventario   SET responsable_id    = NULL WHERE responsable_id    = ?', [req.params.id]);
      await tx.query('UPDATE prestamos    SET empleado_id       = NULL WHERE empleado_id       = ?', [req.params.id]);
      await tx.query('UPDATE prestamos    SET autorizado_por_id = NULL WHERE autorizado_por_id = ?', [req.params.id]);
      await tx.query('UPDATE historial_inventario SET usuario_id = NULL WHERE usuario_id       = ?', [req.params.id]);
      await tx.query(
        `UPDATE solicitudes_registro SET estado = 'eliminado', revisado_por = NULL
         WHERE username = ? OR revisado_por = ?`,
        [target.username, req.params.id]
      );
      await tx.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    });

    await logAudit(req.user!.username, 'Eliminó usuario', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('delete usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

/**
 * PATCH /api/usuarios/:id/password
 * Cambia la contraseña de otro usuario. Reservado exclusivamente al
 * superadmin, sin importar los permisos de módulo que tenga un admin/técnico.
 *
 * Auth: requiere `rol_nivel >= 4` (superadmin).
 *
 * Parámetros de ruta: `id` — id numérico del usuario objetivo.
 * Body: `{ newPassword: string }` (mínimo 6 caracteres).
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — contraseña actualizada.
 * - 400 — `newPassword` ausente o demasiado corta.
 * - 403 — el usuario autenticado no es superadmin.
 * - 500 — error al cambiar la contraseña.
 */
router.patch('/usuarios/:id/password', ...requireRole(4), async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash   = await db.bcrypt.hash(newPassword, db.ROUNDS);
    const target = await db.queryOne<any>('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.params.id]);
    await logAudit(req.user!.username, 'Cambió contraseña', 'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('change password:', err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

/**
 * PATCH /api/usuarios/:id/activo
 * Activa o desactiva la cuenta de un usuario. Un usuario no puede
 * desactivar su propia cuenta.
 *
 * Auth: requiere `rol_nivel >= 3`.
 *
 * Parámetros de ruta: `id` — id numérico del usuario objetivo.
 * Body: `{ activo: boolean }`
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — estado actualizado.
 * - 400 — se intentó desactivar la propia cuenta.
 * - 403 — el usuario autenticado no tiene rol suficiente.
 * - 500 — error al actualizar.
 */
router.patch('/usuarios/:id/activo', ...requireRole(3), async (req: Request, res: Response) => {
  try {
    const { activo } = req.body;
    if (String(req.user!.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });

    const target = await db.queryOne<any>('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query(
      'UPDATE usuarios SET activo = ?, updated_at = NOW() WHERE id = ?',
      [activo ? 1 : 0, req.params.id]
    );
    await logAudit(req.user!.username,
      activo ? 'Activó usuario' : 'Desactivó usuario',
      'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

/** Mapa `clave de módulo → { columna en BD, nombre legible }` usado por el endpoint de permisos. */
const PERMISO_LABELS: Record<string, { columna: string; nombre: string }> = {
  inventario:  { columna: 'acceso_inventario',  nombre: 'Inventario' },
  prestamos:   { columna: 'acceso_prestamos',   nombre: 'Préstamos' },
  bitacora:    { columna: 'acceso_bitacora',    nombre: 'Bitácora' },
  solicitudes: { columna: 'acceso_solicitudes', nombre: 'Solicitudes de registro' },
  usuarios:    { columna: 'acceso_usuarios',    nombre: 'Usuarios registrados' }
};

/**
 * PATCH /api/usuarios/:id/permisos
 * Otorga o revoca permisos de módulo (inventario, préstamos, bitácora,
 * solicitudes, usuarios) a un admin/técnico. Solo actualiza los módulos
 * presentes en el body; un superadmin no puede recibir permisos porque ya
 * tiene acceso completo.
 *
 * Auth: requiere `rol_nivel >= 4` (superadmin).
 *
 * Parámetros de ruta: `id` — id numérico del usuario objetivo.
 * Body: `{ inventario?, prestamos?, bitacora?, solicitudes?, usuarios?: boolean }` (todos opcionales).
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — permisos actualizados.
 * - 400 — el objetivo ya es superadmin, o no se envió ningún módulo en el body.
 * - 403 — el usuario autenticado no es superadmin.
 * - 404 — el usuario objetivo no existe.
 * - 500 — error al actualizar.
 */
router.patch('/usuarios/:id/permisos', ...requireRole(4), async (req: Request, res: Response) => {
  try {
    const target = await db.queryOne<any>(
      `SELECT u.username, u.nombre, u.apellido, r.nivel
       FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`,
      [req.params.id]
    );
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.nivel >= 4)
      return res.status(400).json({ error: 'Un superadministrador ya tiene acceso completo' });

    const sets: string[]    = [];
    const vals: any[]    = [];
    const cambios: string[] = [];
    for (const [modulo, { columna, nombre }] of Object.entries(PERMISO_LABELS)) {
      if (req.body[modulo] === undefined) continue;
      const valor = !!req.body[modulo];
      sets.push(`${columna} = ?`);
      vals.push(valor ? 1 : 0);
      cambios.push(`${nombre}: ${valor ? 'otorgado' : 'revocado'}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No se especificó ningún módulo' });

    vals.push(req.params.id);
    await db.query(`UPDATE usuarios SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);

    await logAudit(req.user!.username, 'Actualizó permisos de acceso avanzado', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''} — ${cambios.join(', ')}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar los permisos' });
  }
});

/** Etiqueta legible por nivel de rol (staff), usada solo para mostrar en autocompletados. */
const ROL_LABEL: Record<number, string> = { 2: 'Técnico', 3: 'Admin', 4: 'Superadmin' };

/**
 * GET /api/usuarios/lista
 * Lista ligera de todos los usuarios activos (nombre + detalle de
 * departamento/área o rol), pensada para autocompletados (ej. asignar
 * ticket, seleccionar responsable de inventario) sin exponer datos
 * sensibles como correo o teléfono.
 *
 * Auth: requiere `rol_nivel >= 2`.
 *
 * Respuesta 200: `Array<{ id, nombre, esPortal: boolean, detalle: string }>`
 * - `esPortal`: `true` si es empleado (rol_nivel 1); `detalle` muestra su departamento/área.
 * - Si no es empleado, `detalle` muestra la etiqueta de su rol (Técnico/Admin/Superadmin).
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — el usuario autenticado no es staff.
 * - 500 — error al cargar la lista.
 */
router.get('/usuarios/lista', ...requireRole(2), async (req: Request, res: Response) => {
  try {
    const rows = await db.query<any>(
      `SELECT u.id,
              LTRIM(RTRIM(CONCAT(u.nombre, ' ', ISNULL(u.apellido, '')))) AS nombre,
              u.area,
              d.nombre AS departamento,
              r.nivel
       FROM usuarios u
       LEFT JOIN departamentos d ON d.id = u.departamento_id
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = 1
       ORDER BY u.nombre`
    );
    res.json(rows.map(u => {
      const esPortal = u.nivel === 1;
      return {
        id:       u.id,
        nombre:   (u.nombre || '').trim(),
        esPortal,
        detalle:  esPortal
          ? ((u.departamento || u.area || 'Sin departamento asignado').trim())
          : (ROL_LABEL[u.nivel] || '')
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar lista de usuarios' });
  }
});

/**
 * GET /api/admins
 * Lista el personal del sistema (técnicos, admins, superadmins) junto con
 * sus permisos de módulo otorgados.
 *
 * Auth: requiere `rol_nivel >= 2`.
 *
 * Respuesta 200: `Array<{ id, username, nombre, rol, nivel, acceso_inventario, acceso_prestamos, acceso_bitacora, acceso_solicitudes, acceso_usuarios }>`
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — el usuario autenticado no es staff.
 * - 500 — error al cargar.
 */
router.get('/admins', ...requireRole(2), async (req: Request, res: Response) => {
  try {
    const users = await db.exec<any>('sp_GetAdmins');
    res.json(users.map(u => ({
      id:                 u.id,
      username:           u.username,
      nombre:             u.nombre.trim(),
      rol:                u.rol,
      nivel:              u.nivel,
      acceso_inventario:  !!u.acceso_inventario,
      acceso_prestamos:   !!u.acceso_prestamos,
      acceso_bitacora:    !!u.acceso_bitacora,
      acceso_solicitudes: !!u.acceso_solicitudes,
      acceso_usuarios:    !!u.acceso_usuarios
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

/**
 * POST /api/admins
 * Da de alta un usuario técnico directamente (sin pasar por el flujo de
 * solicitud de registro). Queda pre-aprobado, con rol `'tecnico'` y sin
 * permisos de módulo (se otorgan aparte vía `PATCH /usuarios/:id/permisos`).
 *
 * Auth: requiere `rol_nivel >= 3`.
 *
 * Body: `{ username: string, password: string, nombre: string }`
 * - `username`: 3-20 caracteres, letras/números/guión bajo, debe ser único.
 *
 * Respuesta 201: `{ ok: true }`
 *
 * Códigos de estado:
 * - 201 — usuario técnico creado.
 * - 400 — faltan campos requeridos, o `username` no cumple el formato.
 * - 403 — el usuario autenticado no tiene rol suficiente.
 * - 409 — el `username` ya existe.
 * - 500 — error al crear el usuario.
 */
router.post('/admins', ...requireRole(3), async (req: Request, res: Response) => {
  try {
    const { username, password, nombre } = req.body;

    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });
    if (!USERNAME_RE.test(username.trim()))
      return res.status(400).json({ error: 'El usuario debe tener 3-20 caracteres: letras, números o guión bajo.' });
    if (String(password).length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const exists = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);
    await db.query(
      `INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo,
                             registro_aprobado, registro_aprobado_por, registro_aprobado_en)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE nombre = 'tecnico'), 1, 1, ?, GETDATE())`,
      [username.trim(), hash, nombre.trim(), req.user!.id]
    );

    await logAudit(req.user!.username, 'Creó usuario técnico', 'usuario', null, `@${username.trim()} — ${nombre.trim()}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

/**
 * DELETE /api/admins/:username
 * Desactiva (no elimina) a un miembro del personal del sistema. No permite
 * dejar el sistema sin ningún administrador activo.
 *
 * Auth: requiere `rol_nivel >= 3`.
 *
 * Parámetros de ruta: `username` — username del usuario a desactivar.
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — desactivado correctamente.
 * - 400 — es el único administrador activo restante.
 * - 403 — el usuario autenticado no tiene rol suficiente.
 * - 500 — error al desactivar.
 */
router.delete('/admins/:username', ...requireRole(3), async (req: Request, res: Response) => {
  try {
    const admins = await db.query<any>(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.nivel >= 2 AND u.activo = 1`
    );
    if (admins.length <= 1)
      return res.status(400).json({ error: 'No se puede eliminar el único administrador' });

    await db.query('UPDATE usuarios SET activo = 0 WHERE username = ?', [req.params.username]);
    await logAudit(req.user!.username, 'Eliminó usuario técnico', 'usuario', null, `@${req.params.username}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

/**
 * GET /api/solicitudes
 * Lista las solicitudes de registro de empleados pendientes de revisión.
 *
 * Auth: superadmin, o acceso al módulo `'solicitudes'`.
 *
 * Respuesta 200: filas de `sp_GetSolicitudes`.
 *
 * Códigos de estado:
 * - 200 — listado cargado.
 * - 403 — sin acceso al módulo.
 * - 500 — error al cargar solicitudes.
 */
router.get('/solicitudes', ...requireSuperadminOrAcceso('solicitudes'), async (req: Request, res: Response) => {
  try {
    res.json(await db.exec('sp_GetSolicitudes'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar solicitudes' });
  }
});

/**
 * POST /api/solicitudes/:id/aprobar
 * Aprueba una solicitud de registro: crea la cuenta del empleado (vía
 * `sp_AprobarSolicitud`, que valida estado y unicidad a nivel de BD).
 *
 * Auth: superadmin, o acceso al módulo `'solicitudes'`.
 *
 * Parámetros de ruta: `id` — id numérico de la solicitud.
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — solicitud aprobada y cuenta creada.
 * - 403 — sin acceso al módulo.
 * - 404 — la solicitud no existe (`err.number === 50404` desde el SP).
 * - 409 — conflicto, ej. username/email ya usados (`err.number === 50409` desde el SP).
 * - 500 — error inesperado al aprobar.
 */
router.post('/solicitudes/:id/aprobar', ...requireSuperadminOrAcceso('solicitudes'), async (req: Request, res: Response) => {
  try {
    await db.exec('sp_AprobarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy: req.user!.username
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err.number === 50404) return res.status(404).json({ error: err.message });
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error('aprobar solicitud:', err);
    res.status(500).json({ error: err.message || 'Error al aprobar la solicitud' });
  }
});

/**
 * POST /api/solicitudes/:id/rechazar
 * Rechaza una solicitud de registro, con un motivo opcional.
 *
 * Auth: superadmin, o acceso al módulo `'solicitudes'`.
 *
 * Parámetros de ruta: `id` — id numérico de la solicitud.
 * Body: `{ motivo?: string }`
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — solicitud rechazada.
 * - 403 — sin acceso al módulo.
 * - 404 — la solicitud no existe.
 * - 409 — la solicitud ya fue procesada previamente.
 * - 500 — error inesperado al rechazar.
 */
router.post('/solicitudes/:id/rechazar', ...requireSuperadminOrAcceso('solicitudes'), async (req: Request, res: Response) => {
  try {
    const { motivo } = req.body;
    await db.exec('sp_RechazarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy: req.user!.username,
      motivo: motivo || null
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err.number === 50404) return res.status(404).json({ error: err.message });
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar la solicitud' });
  }
});

export default router;
