// DTOs devueltos por la API — espejo de las interfaces del backend
// (server/src/types.ts) para las formas que el frontend consume.

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

export type TicketStatus = 'abierto' | 'en_progreso' | 'cerrado';
export type TicketPrioridad = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type TicketCategoria = 'Hardware' | 'Software' | 'Red' | 'Acceso' | 'Otro';

export interface Ticket {
  id: string;
  title: string;
  desc: string;
  status: TicketStatus;
  prioridad: TicketPrioridad;
  categoria: TicketCategoria;
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

export type InvCondicion = 'nuevo' | 'excelente' | 'bueno' | 'regular' | 'danado';
export type InvEstado = 'disponible' | 'en_uso' | 'en_prestamo' | 'en_reparacion' | 'de_baja';
export type InvTipoManejo = 'unidad' | 'cantidad';

export interface Garantia {
  inicio?: string;
  vence?: string;
  proveedor?: string;
}

export interface InventoryItem {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  color: string;
  condicion: InvCondicion;
  estado: InvEstado;
  tipoManejo: InvTipoManejo;
  cantidadTotal: number | null;
  cantidadPrestada: number;
  ubicacion: string;
  responsable: string;
  notas: string;
  garantia: Garantia | null;
  fechaIngreso: string;
  fechaTs: number;
}

export type LoanEstado = 'activo' | 'devuelto';

export interface Loan {
  id: string;
  inventoryId: string;
  empleado: string;
  departamento: string;
  fechaPrestamo: string;
  fechaPrestamoTs: number;
  fechaDevolucionEstimada: string;
  fechaDevolucionReal: string | null;
  estado: LoanEstado;
  cantidad: number;
  cantidadDevuelta: number;
  autorizadoPor: string;
  notas: string;
  equipoDesc: string;
}

export interface UsuarioListado {
  id: number;
  nombre: string;
  detalle: string;
  esPortal: boolean;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  departamento: string | null;
  finca: string | null;
  area: string | null;
  rol: string;
  nivel: number;
  activo: boolean;
  ultimo_login: string | null;
  created_at: string;
  acceso_inventario: boolean;
  acceso_prestamos: boolean;
  acceso_bitacora: boolean;
  acceso_solicitudes: boolean;
}

export type SolicitudEstado = 'pendiente' | 'aprobado' | 'rechazado';

export interface Solicitud {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  username: string;
  telefono: string | null;
  mensaje: string | null;
  estado: SolicitudEstado;
  motivo_rechazo: string | null;
  created_at: string;
  revisado_en: string | null;
  departamento: string | null;
  finca: string | null;
  area: string | null;
  revisado_por_nombre: string | null;
}

export interface UsuarioTicketSummary {
  id: string;
  titulo: string;
  status: string;
  prioridad: string;
  categoria: string;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  fecha: string;
  actor: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalle: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  nombre: string;
  rol: string;
  nivel: number;
  acceso_inventario: boolean;
  acceso_prestamos: boolean;
  acceso_bitacora: boolean;
  acceso_solicitudes: boolean;
  acceso_usuarios: boolean;
}
