/**
 * Estado en memoria de las sesiones de "subir adjunto desde el celular" (flujo
 * QR): el empleado genera un QR desde un ticket, lo escanea con su teléfono
 * sin necesidad de iniciar sesión, y el archivo sube directo a la sesión
 * identificada por un token. Al ser en memoria (no persistido en BD), estas
 * sesiones se pierden si el proceso se reinicia — son de corta duración por diseño.
 */
import fs from 'fs';
import { MobileSession } from './types';

/** Mapa `token → sesión` de subidas móviles activas. */
const mobileSessions = new Map<string, MobileSession>();
/** Tiempo de vida de una sesión de subida móvil: 5 minutos. */
const SESSION_TTL    = 5 * 60 * 1000;

// Barrido periódico que limpia sesiones vencidas y borra del disco el archivo
// asociado (si llegó a subirse), para no dejar adjuntos huérfanos.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of mobileSessions) {
    if (s.expiresAt < now) {
      if (s.filePath && fs.existsSync(s.filePath)) fs.unlink(s.filePath, () => {});
      mobileSessions.delete(token);
    }
  }
}, 60_000);

export { mobileSessions, SESSION_TTL };
