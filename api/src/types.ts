// Tipos compartidos del backend. `db.query/exec` no tipa las filas de SQL Server
// fila por fila (serían >20 tablas) — estos tipos cubren los DTOs que ya
// shape-eaba el código JS (ticketLoader, JWT) y las formas mínimas necesarias
// para tipar el resto de rutas sin modelar el esquema completo.

export interface JwtUser {
  id: number;
  username: string;
  nombre: string;
  rol_nivel: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export interface TicketComment {
  ts: string;
  user: string;
  rolNivel: number;
  text: string;
}

export interface TicketHistoryEntry {
  ts: string;
  user: string;
  accion: string;
}

export interface TicketAttachment {
  name: string;
  path: string;
  size: number;
  ts: string;
}

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
  notes: TicketComment[];
  history: TicketHistoryEntry[];
  attachments: TicketAttachment[];
  deviceId?: string;
}

export interface MobileSessionFile {
  name: string;
  size: number;
  path: string;
}

export interface MobileSession {
  status: 'pending' | 'ready';
  file: MobileSessionFile | null;
  filePath: string | null;
  expiresAt: number;
}

export {};
