const path   = require('path');
const multer = require('multer');
const { UPLOADS } = require('../config');

const ALLOWED_MEDIA = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|3gp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  }
});

const mobileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `mob-${req.params.token}-${Date.now()}${ext}`);
  }
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
