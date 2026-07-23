/**
 * Configuración global del backend leída de variables de entorno (`.env`).
 * Centraliza rutas absolutas y constantes que usan varios módulos, y falla
 * rápido (`throw`) si falta configuración crítica de seguridad.
 */
import path from 'path';

// process.cwd() en vez de __dirname: el compilado (dist/src/config.js) queda
// un nivel más profundo que el fuente (src/config.ts), así que una ruta
// relativa a __dirname apuntaría a un directorio distinto según se ejecute
// con tsx (dev) o con el build de dist (prod). El proceso siempre se lanza
// desde la raíz del repo (npm scripts / pm2 cwd), así que cwd es estable.
const ROOT    = process.cwd();
/** Directorio absoluto donde se guardan los adjuntos subidos (fotos, videos, docs). */
const UPLOADS = path.join(ROOT, 'uploads');
/** Directorio absoluto de recursos estáticos propios del backend (ej. logo para correos). */
const ASSETS  = path.join(ROOT, 'assets');
/** Puerto en el que escucha esta API (Express). Default 8080. */
const PORT    = parseInt(process.env.PORT || '8080');
// Puerto del frontend Next.js (web/) — usado solo como fallback para armar la
// URL del QR de subida desde celular cuando no hay WEB_APP_URL configurado.
const WEB_PORT = parseInt(process.env.WEB_PORT || '8081');

// Validación al cargar el módulo (fail-fast): sin un secreto fuerte no se
// puede firmar/verificar JWT de forma segura, así que el proceso no debe
// arrancar en ese estado.
const rawSessionSecret = process.env.SESSION_SECRET;
if (!rawSessionSecret) throw new Error('SESSION_SECRET no está configurado en .env');
if (rawSessionSecret.length < 32)
  throw new Error('SESSION_SECRET es demasiado corto (mínimo 32 caracteres) — genera uno con: openssl rand -hex 32');
/** Secreto usado para firmar y verificar los JWT de sesión (ver `middleware/auth.ts`). */
const SESSION_SECRET: string = rawSessionSecret;

export { UPLOADS, ASSETS, PORT, WEB_PORT, SESSION_SECRET };
