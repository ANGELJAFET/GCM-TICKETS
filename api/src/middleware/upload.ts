/**
 * Configuración de `multer` para subida de adjuntos: valida extensión, limita
 * tamaño y genera nombres de archivo aleatorios en disco (nunca a partir del
 * nombre original ni de parámetros de la request, para evitar path traversal).
 * Expone dos instancias: {@link upload} para adjuntos normales (tickets) y
 * {@link mobileUpload} para el flujo de subida desde celular vía QR.
 */
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { UPLOADS } from '../config';

/** Extensiones de imagen/video aceptadas para adjuntos. */
const ALLOWED_MEDIA = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|3gp)$/i;

// El nombre de archivo se genera con un id aleatorio propio — nunca a partir de
// req.params (id de ticket / token), que podría contener secuencias "../" y
// escribir fuera de UPLOADS (path traversal vía nombre de archivo de multer).
const randomName = (prefix: string, ext: string) => `${prefix}${crypto.randomBytes(16).toString('hex')}${ext}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => cb(null, randomName('', path.extname(file.originalname)))
});

const mobileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => cb(null, randomName('mob-', path.extname(file.originalname)))
});

/** Middleware de subida para adjuntos de tickets (máx. 50 MB, extensiones permitidas). */
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

/** Middleware de subida para el flujo de "subir desde celular" vía QR (prefijo `mob-` en el nombre de archivo). */
const mobileUpload = multer({
  storage: mobileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

export { upload, mobileUpload };
