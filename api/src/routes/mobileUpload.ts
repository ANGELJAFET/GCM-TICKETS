/**
 * Flujo de "subir adjunto desde el celular" vía código QR, sin necesidad de
 * iniciar sesión en el teléfono: el navegador (con sesión) crea una sesión
 * efímera y genera un QR; el celular escanea, abre `/mobile-upload?session=...`
 * y sube el archivo directo a esa sesión (identificada solo por un token
 * aleatorio). Por eso estas rutas, a propósito, no llevan `requireAuth` — el
 * dispositivo móvil nunca tiene ni necesita un JWT.
 * Montado en `server.ts` bajo el prefijo `/api/mobile-upload`.
 */
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { mobileUpload } from '../middleware/upload';
import { mobileSessions, SESSION_TTL } from '../mobileSessions';
import { getWebAppUrl } from '../helpers';

const router = express.Router();

// Estas rutas no llevan auth (el celular no tiene JWT), así que un rate limit
// por IP evita que alguien en la LAN cree sesiones o suba archivos de 50 MB sin
// límite (DoS de disco). El tope es holgado para no estorbar el uso real
// (varias fotos por sesión de préstamo desde un mismo teléfono).
const mobileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.' },
});

/**
 * POST /api/mobile-upload/session
 * Crea una sesión de subida móvil efímera (TTL de `SESSION_TTL`, 5 min) y
 * retorna su token. El navegador usa este token para pedir el QR y luego
 * consultar el estado de la subida.
 *
 * Auth: ninguna (ver nota del módulo).
 *
 * Respuesta 200: `{ token: string }`
 */
router.post('/session', mobileLimiter, (req: Request, res: Response) => {
  const token = crypto.randomBytes(16).toString('hex');
  mobileSessions.set(token, { status: 'pending', file: null, filePath: null, files: [], filePaths: [], expiresAt: Date.now() + SESSION_TTL });
  res.json({ token });
});

/**
 * GET /api/mobile-upload/qr/:token
 * Genera un código QR (PNG) que apunta a `{WEB_APP_URL}/mobile-upload?session=:token`,
 * la página que el celular abre al escanear.
 *
 * Auth: ninguna (ver nota del módulo).
 *
 * Parámetros de ruta: `token` — token de la sesión (de `POST /session`).
 * Query: `type?` — string cosmético que ajusta el texto mostrado en `/mobile-upload`; no afecta la sesión.
 *
 * Respuesta 200: imagen PNG (`Content-Type: image/png`) con el QR.
 *
 * Códigos de estado:
 * - 200 — QR generado.
 * - 410 — la sesión no existe o ya expiró.
 * - 500 — error al generar el QR.
 */
router.get('/qr/:token', async (req: Request, res: Response) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Sesión expirada' });

  // `type` es solo cosmético (ajusta el texto/opciones que ve el celular en
  // /mobile-upload) — la sesión en sí es genérica y no distingue de dónde vino.
  const type = typeof req.query.type === 'string' ? `&type=${encodeURIComponent(req.query.type)}` : '';
  const url = `${getWebAppUrl()}/mobile-upload?session=${req.params.token}${type}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.set('Content-Type', 'image/png').send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QR' });
  }
});

/**
 * POST /api/mobile-upload/:token
 * Recibe un archivo subido desde el celular (`multipart/form-data`) y lo
 * **acumula** en la sesión: se agrega a `files`/`filePaths` y además queda como
 * el archivo "actual" (`file`/`filePath`) para los consumidores de una sola
 * foto. Los flujos de una foto (tickets, inventario) suben una única vez por
 * sesión; el flujo multi-foto (préstamos) puede subir varias veces.
 *
 * Auth: ninguna (ver nota del módulo).
 *
 * Parámetros de ruta: `token` — token de la sesión.
 * Body: `multipart/form-data` con campo `file` (ver `middleware/upload.ts`, instancia `mobileUpload`).
 *
 * Respuesta 200: `{ ok: true, count: number }` (cantidad de archivos acumulados).
 *
 * Códigos de estado:
 * - 200 — archivo recibido, sesión pasa a estado `'ready'`.
 * - 400 — no se recibió archivo.
 * - 410 — la sesión no existe o ya expiró (el archivo recibido, si lo hubo, se borra).
 */
router.post('/:token', mobileLimiter, mobileUpload.single('file'), (req: Request, res: Response) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(410).json({ error: 'Sesión expirada' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const nuevo = { name: req.file.originalname, size: req.file.size, path: `/uploads/${req.file.filename}` };
  s.files.push(nuevo);
  s.filePaths.push(req.file.path);
  s.status   = 'ready';
  s.file     = nuevo;              // último archivo, para consumidores de una sola foto
  s.filePath = req.file.path;
  res.json({ ok: true, count: s.files.length });
});

/**
 * GET /api/mobile-upload/status/:token
 * Consultado por el navegador para saber si el celular ya subió el archivo
 * (polling desde la pantalla que muestra el QR).
 *
 * Auth: ninguna (ver nota del módulo).
 *
 * Parámetros de ruta: `token` — token de la sesión.
 *
 * Respuesta 200: `{ status: 'pending' | 'ready', file: MobileSessionFile | null, files: MobileSessionFile[] }`
 * (`file` es el último archivo, para el flujo de una sola foto; `files` es el arreglo completo, para multi-foto.)
 *
 * Códigos de estado:
 * - 200 — estado actual de la sesión.
 * - 410 — la sesión no existe o ya expiró.
 */
router.get('/status/:token', (req: Request, res: Response) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Expirada' });
  res.json({ status: s.status, file: s.file, files: s.files });
});

export default router;
