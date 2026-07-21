import express, { Request, Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { mobileUpload } from '../middleware/upload';
import { mobileSessions, SESSION_TTL } from '../mobileSessions';
import { getWebAppUrl } from '../helpers';

const router = express.Router();

// POST /api/mobile-upload/session
router.post('/session', (req: Request, res: Response) => {
  const token = crypto.randomBytes(16).toString('hex');
  mobileSessions.set(token, { status: 'pending', file: null, filePath: null, expiresAt: Date.now() + SESSION_TTL });
  res.json({ token });
});

// GET /api/mobile-upload/qr/:token
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

// POST /api/mobile-upload/:token
router.post('/:token', mobileUpload.single('file'), (req: Request, res: Response) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(410).json({ error: 'Sesión expirada' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  if (s.filePath && fs.existsSync(s.filePath)) fs.unlink(s.filePath, () => {});

  s.status   = 'ready';
  s.filePath = req.file.path;
  s.file     = { name: req.file.originalname, size: req.file.size, path: `/uploads/${req.file.filename}` };
  res.json({ ok: true });
});

// GET /api/mobile-upload/status/:token
router.get('/status/:token', (req: Request, res: Response) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Expirada' });
  res.json({ status: s.status, file: s.file });
});

export default router;
