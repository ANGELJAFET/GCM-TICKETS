const express      = require('express');
const router       = express.Router();
const db           = require('../db');
const { logAudit } = require('../helpers');

// GET /api/usuarios
router.get('/usuarios', async (req, res) => {
  try {
    res.json(await db.exec('sp_GetUsuarios'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

// GET /api/usuarios/:id/tickets
router.get('/usuarios/:id/tickets', async (req, res) => {
  try {
    const user = await db.queryOne('SELECT nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const nombre  = `${user.nombre} ${user.apellido || ''}`.trim();
    const tickets = await db.query(
      `SELECT id, titulo, status, prioridad, categoria, created_at
       FROM tickets WHERE reporter_nombre = ? ORDER BY created_at DESC`,
      [nombre]
    );
    res.json({ nombre, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets del usuario' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/usuarios/:id', async (req, res) => {
  try {
    const { requestedBy } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede eliminar usuarios' });

    const self = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [requestedBy]);
    if (self && String(self.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const target = await db.queryOne('SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.query('UPDATE tickets      SET asignado_id       = NULL WHERE asignado_id      = ?', [req.params.id]);
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

    await logAudit(requestedBy, 'Eliminó usuario', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete usuario:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar usuario' });
  }
});

// PATCH /api/usuarios/:id/password
router.patch('/usuarios/:id/password', async (req, res) => {
  try {
    const { requestedBy, newPassword } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede cambiar contraseñas' });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash   = await db.bcrypt.hash(newPassword, db.ROUNDS);
    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.params.id]);
    await logAudit(requestedBy, 'Cambió contraseña', 'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('change password:', err);
    res.status(500).json({ error: err.message || 'Error al cambiar contraseña' });
  }
});

// PATCH /api/usuarios/:id/activo
router.patch('/usuarios/:id/activo', async (req, res) => {
  try {
    const { requestedBy, activo } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede modificar usuarios' });

    const self = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [requestedBy]);
    if (self && String(self.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });

    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query(
      'UPDATE usuarios SET activo = ?, updated_at = NOW() WHERE id = ?',
      [activo ? 1 : 0, req.params.id]
    );
    await logAudit(requestedBy,
      activo ? 'Activó usuario' : 'Desactivó usuario',
      'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// GET /api/admins
router.get('/admins', async (req, res) => {
  try {
    const users = await db.exec('sp_GetAdmins');
    res.json(users.map(u => ({
      username: u.username,
      nombre:   u.nombre.trim(),
      rol:      u.rol,
      nivel:    u.nivel
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

// POST /api/admins
router.post('/admins', async (req, res) => {
  try {
    const { username, password, nombre, requestedBy } = req.body;

    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede crear usuarios' });
    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });

    const exists = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);
    await db.query(
      `INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo,
                             registro_aprobado, registro_aprobado_por, registro_aprobado_en)
       SELECT ?, ?, ?, (SELECT id FROM roles WHERE nombre = 'tecnico'), 1, 1, id, GETDATE()
       FROM usuarios WHERE username = ?`,
      [username.trim(), hash, nombre.trim(), requestedBy]
    );

    await logAudit(requestedBy, 'Creó usuario técnico', 'usuario', null, `@${username.trim()} — ${nombre.trim()}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// DELETE /api/admins/:username
router.delete('/admins/:username', async (req, res) => {
  try {
    if (!await db.isAdmin(req.body?.requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede eliminar usuarios' });

    const admins = await db.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.nivel >= 2 AND u.activo = 1`
    );
    if (admins.length <= 1)
      return res.status(400).json({ error: 'No se puede eliminar el único administrador' });

    await db.query('UPDATE usuarios SET activo = 0 WHERE username = ?', [req.params.username]);
    await logAudit(req.body?.requestedBy, 'Eliminó usuario técnico', 'usuario', null, `@${req.params.username}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// GET /api/solicitudes
router.get('/solicitudes', async (req, res) => {
  try {
    res.json(await db.exec('sp_GetSolicitudes'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar solicitudes' });
  }
});

// POST /api/solicitudes/:id/aprobar
router.post('/solicitudes/:id/aprobar', async (req, res) => {
  try {
    const { requestedBy } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede aprobar solicitudes' });

    await db.exec('sp_AprobarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy
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
router.post('/solicitudes/:id/rechazar', async (req, res) => {
  try {
    const { requestedBy, motivo } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede rechazar solicitudes' });

    await db.exec('sp_RechazarSolicitud', {
      solicitud_id: parseInt(req.params.id),
      requestedBy,
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
