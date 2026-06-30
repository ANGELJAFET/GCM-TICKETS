const express = require('express');
const router  = express.Router();
const db      = require('../db');
const mailer  = require('../mailer');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });

    const user = await db.execOne('sp_GetUserForLogin', { username });
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const ok = await db.bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    await db.exec('sp_UpdateLastLogin', { username });

    res.json({
      ok:        true,
      nombre:    `${user.nombre} ${user.apellido || ''}`.trim(),
      rol:       user.rol,
      rol_nivel: user.rol_nivel
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, nombre, apellido, telefono, departamento, mensaje } = req.body;

    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);

    await db.exec('sp_InsertSolicitudRegistro', {
      nombre:              nombre.trim(),
      apellido:            apellido?.trim()     || null,
      email:               email?.trim()        || null,
      username:            username.trim(),
      password_hash:       hash,
      telefono:            telefono?.trim()     || null,
      departamento_nombre: departamento?.trim() || null,
      mensaje:             mensaje?.trim()      || null
    });

    res.status(201).json({ ok: true });

    // Notificar al admin sobre la nueva solicitud de registro
    const adminEmail = process.env.SMTP_USER;
    if (adminEmail) {
      const tpl = mailer.emailNuevoRegistro({
        nombre:       `${nombre.trim()} ${(apellido || '').trim()}`.trim(),
        username:     username.trim(),
        departamento: departamento || null,
      });
      mailer.send({ to: adminEmail, ...tpl });
    }
  } catch (err) {
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

module.exports = router;
