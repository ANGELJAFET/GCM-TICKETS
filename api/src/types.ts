// Tipos compartidos del backend. `db.query/exec` no tipa las filas de SQL Server
// fila por fila (serían >20 tablas) — estos tipos cubren los DTOs que ya
// shape-eaba el código JS (ticketLoader, JWT) y las formas mínimas necesarias
// para tipar el resto de rutas sin modelar el esquema completo.

/** Payload decodificado del JWT de sesión; queda disponible en `req.user` tras `middleware/auth.ts`. */
export interface JwtUser {
  id: number;
  username: string;
  nombre: string;
  /** Nivel de rol: 1 empleado, 2 técnico, 3 admin, 4 superadmin (ver README). */
  rol_nivel: number;
}

// Extiende el tipo Request de Express para que `req.user` sea reconocido por
// TypeScript en todas las rutas, sin necesidad de castear en cada handler.
declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

/** Comentario visible para el empleado o nota interna (solo staff) dentro de un ticket. */
export interface TicketComment {
  ts: string;
  user: string;
  rolNivel: number;
  text: string;
}

/** Entrada del historial de cambios de estado/asignación de un ticket. */
export interface TicketHistoryEntry {
  ts: string;
  user: string;
  accion: string;
}

/** Archivo adjunto a un ticket (imagen, video o documento). */
export interface TicketAttachment {
  name: string;
  path: string;
  size: number;
  ts: string;
}

/** Forma completa de un ticket tal como lo consume el frontend. */
export interface Ticket {
  id: string;
  title: string;
  desc: string;
  status: string;
  prioridad: string;
  categoria: string;
  asignado: string;
  reporter: string;
  reporterId: number | null;
  fecha: string;
  fechaTs: number;
  comments: TicketComment[];
  /** Notas internas, solo visibles para técnicos/admins (no para el empleado). */
  notes: TicketComment[];
  history: TicketHistoryEntry[];
  attachments: TicketAttachment[];
  /** Identificador del dispositivo móvil, si el adjunto se subió vía QR (ver `mobileUpload.ts`). */
  deviceId?: string;
}

/** Archivo recibido en una sesión de subida desde celular (ver `mobileSessions.ts`). */
export interface MobileSessionFile {
  name: string;
  size: number;
  path: string;
}

/** Estado de una sesión de subida de adjuntos vía QR desde celular. */
export interface MobileSession {
  /** `'pending'` mientras se espera el primer archivo; `'ready'` una vez subido al menos uno. */
  status: 'pending' | 'ready';
  /**
   * Último archivo subido (o `null`). Se mantiene para los consumidores de una
   * sola foto (tickets, inventario), que solo leen este campo; en una sesión
   * multi-foto apunta al más reciente de `files`.
   */
  file: MobileSessionFile | null;
  /** Ruta en disco del último archivo (par de `file`); ver nota de `file`. */
  filePath: string | null;
  /** Todos los archivos subidos en la sesión, en orden (flujo multi-foto, ej. préstamos). */
  files: MobileSessionFile[];
  /** Rutas en disco de todos los archivos (par de `files`), usadas por el barrido de limpieza. */
  filePaths: string[];
  /** Timestamp (ms) en el que la sesión expira y deja de aceptar subidas. */
  expiresAt: number;
}

export {};
