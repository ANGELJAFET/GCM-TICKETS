const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const db      = require('../db');
const mailer  = require('../mailer');
const { SESSION_SECRET } = require('../config');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FINCAS = [
  'FINCA CORML', 'FINCA EMAR', 'FINCA NOVAHONDURAS 7', 'FINCA LA ESPERANZA',
  'FINCA CORML 1', 'FINCA CORML 2', 'FINCA CADEMA', 'FINCA EL CONCHAL',
  'No aplica'
];

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

    const nombre = `${user.nombre} ${user.apellido || ''}`.trim();
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre, rol_nivel: user.rol_nivel },
      SESSION_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      ok:                 true,
      token,
      id:                 user.id,
      nombre,
      rol:                user.rol,
      rol_nivel:          user.rol_nivel,
      acceso_inventario:  !!user.acceso_inventario,
      acceso_prestamos:   !!user.acceso_prestamos,
      acceso_bitacora:    !!user.acceso_bitacora,
      acceso_solicitudes: !!user.acceso_solicitudes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, nombre, apellido, telefono, departamento, finca, area, mensaje } = req.body;

    if (!username || !password || !nombre || !email)
      return res.status(400).json({ error: 'Usuario, correo, contraseña y nombre son requeridos.' });
    if (!USERNAME_RE.test(username.trim()))
      return res.status(400).json({ error: 'El usuario debe tener 3-20 caracteres: letras, números o guión bajo.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    if (!EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
    if (!finca || !FINCAS.includes(finca))
      return res.status(400).json({ error: 'Selecciona una finca válida.' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);

    await db.exec('sp_InsertSolicitudRegistro', {
      nombre:              nombre.trim(),
      apellido:            apellido?.trim()     || null,
      email:               email.trim(),
      username:            username.trim(),
      password_hash:       hash,
      telefono:            telefono?.trim()     || null,
      departamento_nombre: departamento?.trim() || null,
      finca,
      area:                area?.trim()         || null,
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
        finca,
        area:         area || null,
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
