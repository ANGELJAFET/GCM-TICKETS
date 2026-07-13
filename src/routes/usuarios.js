const express      = require('express');
const router       = express.Router();
const db           = require('../db');
const { logAudit } = require('../helpers');
const { requireRole, requireSuperadminOrAcceso } = require('../middleware/auth');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// GET /api/usuarios
// Ver el listado (datos personales de otros usuarios) requiere ser
// superadmin o que el superadmin haya otorgado el módulo 'usuarios'.
router.get('/usuarios', ...requireSuperadminOrAcceso('usuarios'), async (req, res) => {
  try {
    res.json(await db.exec('sp_GetUsuarios'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

// GET /api/usuarios/:id/tickets
router.get('/usuarios/:id/tickets', ...requireSuperadminOrAcceso('usuarios'), async (req, res) => {
  try {
    const user = await db.queryOne('SELECT nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
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

// DELETE /api/usuarios/:id
router.delete('/usuarios/:id', ...requireRole(3), async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const target = await db.queryOne('SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.query('UPDATE tickets      SET asignado_id       = NULL WHERE asignado_id      = ?', [req.params.id]);
    await db.query('UPDATE tickets      SET reporter_id       = NULL WHERE reporter_id      = ?', [req.params.id]);
    await db.query('UPDATE comentarios  SET autor_id          = NULL WHERE autor_id         = ?', [req.params.id]);
    await db.query('UPDATE historial_tickets SET usuario_id   = NULL WHERE usuario_id       = ?', [req.params.id]);
    await db.query('UPDATE dispositivos SET tecnico_id        = NULL WHERE tecnico_id        = ?', [req.params.id]);
    await db.query('UPDATE inventario   SET responsable_id    = NULL WHERE responsable_id    = ?', [req.params.id]);
    await db.query('UPDATE prestamos    SET empleado_id       = NULL WHERE empleado_id       = ?', [req.params.id]);
    await db.query('UPDATE prestamos    SET autorizado_por_id = NULL WHERE autorizado_por_id = ?', [req.params.id]);
    await db.query('UPDATE historial_inventario SET usuario_id = NULL WHERE usuario_id       = ?', [req.params.id]);
    await db.query(
      `UPDATE solicitudes_registro SET estado = 'eliminado', revisado_por = NULL
       WHERE username = ? OR revisado_por = ?`,
      [target.username, req.params.id]
    );
    await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);

    await logAudit(req.user.username, 'Eliminó usuario', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete usuario:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar usuario' });
  }
});

// PATCH /api/usuarios/:id/password
// Solo el superadmin puede cambiar la contraseña de otro usuario.
router.patch('/usuarios/:id/password', ...requireRole(4), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash   = await db.bcrypt.hash(newPassword, db.ROUNDS);
    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.params.id]);
    await logAudit(req.user.username, 'Cambió contraseña', 'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('change password:', err);
    res.status(500).json({ error: err.message || 'Error al cambiar contraseña' });
  }
});

// PATCH /api/usuarios/:id/activo
router.patch('/usuarios/:id/activo', ...requireRole(3), async (req, res) => {
  try {
    const { activo } = req.body;
    if (String(req.user.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });

    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query(
      'UPDATE usuarios SET activo = ?, updated_at = NOW() WHERE id = ?',
      [activo ? 1 : 0, req.params.id]
    );
    await logAudit(req.user.username,
      activo ? 'Activó usuario' : 'Desactivó usuario',
      'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PATCH /api/usuarios/:id/permisos
// Body: { inventario?, prestamos?, bitacora?, solicitudes?, usuarios?: boolean } — solo se
// actualizan los módulos presentes en el body. Solo el superadmin puede otorgar.
const PERMISO_LABELS = {
  inventario:  { columna: 'acceso_inventario',  nombre: 'Inventario' },
  prestamos:   { columna: 'acceso_prestamos',   nombre: 'Préstamos' },
  bitacora:    { columna: 'acceso_bitacora',    nombre: 'Bitácora' },
  solicitudes: { columna: 'acceso_solicitudes', nombre: 'Solicitudes de registro' },
  usuarios:    { columna: 'acceso_usuarios',    nombre: 'Usuarios registrados' }
};

router.patch('/usuarios/:id/permisos', ...requireRole(4), async (req, res) => {
  try {
    const target = await db.queryOne(
      `SELECT u.username, u.nombre, u.apellido, r.nivel
       FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`,
      [req.params.id]
    );
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.nivel >= 4)
      return res.status(400).json({ error: 'Un superadministrador ya tiene acceso completo' });

    const sets    = [];
    const vals    = [];
    const cambios = [];
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

    await logAudit(req.user.username, 'Actualizó permisos de acceso avanzado', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''} — ${cambios.join(', ')}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar los permisos' });
  }
});

// GET /api/admins
router.get('/admins', ...requireRole(2), async (req, res) => {
  try {
    const users = await db.exec('sp_GetAdmins');
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

// POST /api/admins
router.post('/admins', ...requireRole(3), async (req, res) => {
  try {
    const { username, password, nombre } = req.body;

    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });
    if (!USERNAME_RE.test(username.trim()))
      return res.status(400).json({ error: 'El usuario debe tener 3-20 caracteres: letras, números o guión bajo.' });

    const exists = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);
    await db.query(
      `INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo,
                             registro_aprobado, registro_aprobado_por, registro_aprobado_en)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE nombre = 'tecnico'), 1, 1, ?, GETDATE())`,
      [username.trim(), hash, nombre.trim(), req.user.id]
    );

    await logAudit(req.user.username, 'Creó usuario técnico', 'usuario', null, `@${username.trim()} — ${nombre.trim()}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// DELETE /api/admins/:username
router.delete('/admins/:username', ...requireRole(3), async (req, res) => {
  try {
    const admins = await db.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.nivel >= 2 AND u.activo = 1`
    );
    if (admins.length <= 1)
      return res.status(400).json({ error: 'No se puede eliminar el único administrador' });

    await db.query('UPDATE usuarios SET activo = 0 WHERE username = ?', [req.params.username]);
    await logAudit(req.user.username, 'Eliminó usuario técnico', 'usuario', null, `@${req.params.username}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// GET /api/solicitudes
router.get('/solicitudes', ...requireSuperadminOrAcceso('solicitudes'), async (req, res) => {
  try {
    res.json(await db.exec('sp_GetSolicitudes'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar solicitudes' });
  }
});

// POST /api/solicitudes/:id/aprobar
router.post('/solicitudes/:id/aprobar', ...requireSuperadminOrAcceso('solicitudes'), async (req, res) => {
  try {
    await db.exec('sp_AprobarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy: req.user.username
    });

    res.json({ ok: true });
  } catch (err) {
    if (err.number === 50404) return res.status(404).json({ error: err.message });
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error('aprobar solicitud:', err);
    res.status(500).json({ error: err.message || 'Error al aprobar la solicitud' });
  }
});

// POST /api/solicitudes/:id/rechazar
router.post('/solicitudes/:id/rechazar', ...requireSuperadminOrAcceso('solicitudes'), async (req, res) => {
  try {
    const { motivo } = req.body;
    await db.exec('sp_RechazarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy: req.user.username,
      motivo: motivo || null
    });

    res.json({ ok: true });
  } catch (err) {
    if (err.number === 50404) return res.status(404).json({ error: err.message });
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar la solicitud' });
  }
});

module.exports = router;
