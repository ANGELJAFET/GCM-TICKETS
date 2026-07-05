const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS } = require('../config');

const ALLOWED_MEDIA = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|3gp)$/i;

// El nombre de archivo se genera con un id aleatorio propio — nunca a partir de
// req.params (id de ticket / token), que podría contener secuencias "../" y
// escribir fuera de UPLOADS (path traversal vía nombre de archivo de multer).
const randomName = (prefix, ext) => `${prefix}${crypto.randomBytes(16).toString('hex')}${ext}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => cb(null, randomName('', path.extname(file.originalname)))
});

const mobileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => cb(null, randomName('mob-', path.extname(file.originalname)))
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

const mobileUpload = multer({
  storage: mobileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

module.exports = { upload, mobileUpload };
