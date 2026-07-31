/**
 * Rutas de autenticación y registro: login (emite JWT) y alta de solicitudes
 * de registro (quedan pendientes de aprobación por un administrador).
 * Montado en `server.ts` bajo el prefijo `/api/auth`.
 */
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db';
import mailer from '../mailer';
import { SESSION_SECRET } from '../config';

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Protege contra fuerza bruta de contraseña — 10 intentos / 15 min por IP,
// no cuenta los logins exitosos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
});

const FINCAS = [
  'FINCA CORML', 'FINCA EMAR', 'FINCA NOVAHONDURAS 7', 'FINCA LA ESPERANZA',
  'FINCA CORML 1', 'FINCA CORML 2', 'FINCA CADEMA', 'FINCA EL CONCHAL',
  'No aplica'
];

/**
 * POST /api/auth/login
 * Autentica un usuario y, si es válido, emite un JWT de sesión (12h).
 *
 * Rate limit: 10 intentos / 15 min por IP (no cuenta logins exitosos).
 *
 * Body: `{ username: string, password: string, portal?: 'admin' | otro }`
 * - `portal`: indica desde qué portal se intenta iniciar sesión. Un empleado
 *   (rol_nivel 1) no puede entrar por `portal: 'admin'`, y viceversa un
 *   técnico/admin/superadmin no puede entrar por el portal de empleados.
 *
 * Respuesta 200: `{ ok: true, token, id, nombre, rol, rol_nivel, acceso_inventario, acceso_prestamos, acceso_bitacora, acceso_solicitudes, acceso_usuarios }`
 *
 * Códigos de estado:
 * - 200 — login correcto, retorna el token JWT y los permisos de módulo del usuario.
 * - 400 — falta `username` o `password`.
 * - 401 — usuario/contraseña incorrectos, o el portal no corresponde al rol de la cuenta (mismo mensaje genérico por seguridad).
 * - 429 — demasiados intentos fallidos (rate limit).
 * - 500 — error inesperado del servidor.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, portal } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });

    const user = await db.execOne<any>('sp_GetUserForLogin', { username });
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const ok = await db.bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    // El portal (empleado vs. panel admin) que no corresponde al nivel de la
    // cuenta se rechaza con el mismo mensaje genérico que una contraseña
    // incorrecta, para no revelarle a quien no tiene la contraseña correcta
    // si el usuario que probó existe y a qué nivel pertenece.
    const esPortalAdmin = portal === 'admin';
    if (esPortalAdmin  && user.rol_nivel < 2) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    if (!esPortalAdmin && user.rol_nivel >= 2) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    await db.exec('sp_UpdateLastLogin', { username });

    const nombre = `${user.nombre} ${user.apellido || ''}`.trim();
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre, rol_nivel: user.rol_nivel },
      SESSION_SECRET,
      { expiresIn: '12h', algorithm: 'HS256' }
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
      acceso_solicitudes: !!user.acceso_solicitudes,
      acceso_usuarios:    !!user.acceso_usuarios
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

/**
 * POST /api/auth/register
 * Crea una solicitud de registro de empleado, pendiente de aprobación por
 * un administrador (no crea la cuenta directamente). Notifica por correo
 * al administrador (`SMTP_USER`) si el email está configurado.
 *
 * Rate limit: 10 solicitudes / hora por IP.
 *
 * Body: `{ username, email, password, nombre, apellido?, telefono?, departamento?, finca, area?, anydesk, mensaje? }`
 * - `username`: 3-20 caracteres, letras/números/guión bajo.
 * - `password`: mínimo 6 caracteres.
 * - `email`: formato de correo válido.
 * - `finca`: debe ser una de las fincas válidas (o `'No aplica'`).
 * - `anydesk`: obligatorio (ID de AnyDesk del equipo del empleado, para soporte remoto).
 *
 * Respuesta 201: `{ ok: true }`
 *
 * Códigos de estado:
 * - 201 — solicitud registrada correctamente.
 * - 400 — validación fallida (campos requeridos, formato de usuario/correo, finca inválida, contraseña corta).
 * - 409 — ya existe una solicitud o cuenta con ese `username`/`email` (constraint de BD, `err.number === 50409`).
 * - 500 — error inesperado del servidor.
 */
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const { username, email, password, nombre, apellido, telefono, departamento, finca, area, anydesk, mensaje } = req.body;

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
    if (!anydesk || !anydesk.trim())
      return res.status(400).json({ error: 'El ID de AnyDesk es obligatorio.' });

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
      anydesk:             anydesk.trim(),
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
  } catch (err: any) {
    if (err.number === 50409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

export default router;
