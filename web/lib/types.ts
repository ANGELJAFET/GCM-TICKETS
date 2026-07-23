/**
 * DTOs devueltos por la API — espejo de las interfaces del backend
 * (`api/src/types.ts`) para las formas que el frontend consume. No son
 * modelos de dominio propios del frontend: cualquier cambio de forma en el
 * backend debe reflejarse aquí.
 */

/** Comentario visible para el empleado, o nota interna (ver `Ticket.notes`). */
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

/** Archivo adjunto a un ticket; `path` es una ruta servida por el backend (ver `fileUrl` en `api.ts`). */
export interface TicketAttachment {
  name: string;
  path: string;
  size: number;
  ts: string;
}

export type TicketStatus = 'abierto' | 'en_progreso' | 'cerrado';
export type TicketPrioridad = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type TicketCategoria = 'Hardware' | 'Software' | 'Red' | 'Acceso' | 'Otro';

/** Forma completa de un ticket tal como lo entrega la API. */
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
  /** Notas internas, solo visibles para staff (vacío si quien consulta es un empleado). */
  notes: TicketComment[];
  history: TicketHistoryEntry[];
  attachments: TicketAttachment[];
  /** Presente si el ticket se originó de la recepción de un dispositivo externo en taller. */
  deviceId?: string;
}

export type InvCondicion = 'nuevo' | 'excelente' | 'bueno' | 'regular' | 'danado';
export type InvEstado = 'disponible' | 'en_uso' | 'en_prestamo' | 'en_reparacion' | 'de_baja';
export type InvTipoManejo = 'unidad' | 'cantidad';

/** Datos de garantía de un equipo de inventario (todos opcionales, texto libre para `proveedor`). */
export interface Garantia {
  inicio?: string;
  vence?: string;
  proveedor?: string;
}

/**
 * Equipo o lote del inventario. `tipoManejo` determina cómo interpretar
 * `serie`/`cantidadTotal`/`cantidadPrestada`: en modo `'unidad'`, `serie` es
 * obligatoria y `cantidadTotal`/`cantidadPrestada` no aplican (siempre
 * 1 unidad); en modo `'cantidad'`, no hay `serie` y `cantidadPrestada`
 * refleja cuánto del lote está prestado ahora mismo.
 */
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
  foto: string | null;
  notas: string;
  garantia: Garantia | null;
  fechaIngreso: string;
  fechaTs: number;
}

export type LoanEstado = 'activo' | 'devuelto';

/** Préstamo de un equipo/lote de inventario a un empleado; admite devolución parcial vía `cantidad`/`cantidadDevuelta`. */
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
  condicionDevolucion: InvCondicion | null;
  notaDevolucion: string | null;
  equipoDesc: string;
}

/** Fila ligera de usuario para autocompletados (asignar ticket, responsable de inventario, etc.). */
export interface UsuarioListado {
  id: number;
  nombre: string;
  detalle: string;
  esPortal: boolean;
}

/** Ficha completa de un usuario (empleado o staff), tal como la muestra el listado de "Usuarios registrados". */
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

/** Solicitud de registro de un empleado, pendiente de aprobación/rechazo por un administrador. */
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

/** Resumen de un ticket, usado en el detalle de usuario (lista de tickets reportados). */
export interface UsuarioTicketSummary {
  id: string;
  titulo: string;
  status: string;
  prioridad: string;
  categoria: string;
  created_at: string;
}

/** Entrada de la bitácora de auditoría del sistema. */
export interface AuditEntry {
  id: number;
  fecha: string;
  actor: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalle: string | null;
}

/** Miembro del personal del sistema (técnico/admin/superadmin) con sus permisos de módulo otorgados. */
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
