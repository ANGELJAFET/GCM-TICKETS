const express          = require('express');
const fs               = require('fs');
const crypto           = require('crypto');
const QRCode           = require('qrcode');
const router           = express.Router();
const { mobileUpload } = require('../middleware/upload');
const { mobileSessions, SESSION_TTL } = require('../mobileSessions');
const { getLocalIP }   = require('../helpers');
const { PORT }         = require('../config');

// POST /api/mobile-upload/session
router.post('/session', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  mobileSessions.set(token, { status: 'pending', file: null, filePath: null, expiresAt: Date.now() + SESSION_TTL });
  res.json({ token });
});

// GET /api/mobile-upload/qr/:token
router.get('/qr/:token', async (req, res) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Sesión expirada' });

  const base = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '')
    : `http://${getLocalIP()}:${PORT}`;
  const url = `${base}/mobile-upload.html?session=${req.params.token}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.set('Content-Type', 'image/png').send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QR' });
  }
});

// POST /api/mobile-upload/:token
router.post('/:token', mobileUpload.single('file'), (req, res) => {
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
router.get('/status/:token', (req, res) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Expirada' });
  res.json({ status: s.status, file: s.file });
});

module.exports = router;
