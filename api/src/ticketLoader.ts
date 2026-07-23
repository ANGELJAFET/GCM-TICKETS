/**
 * Ensambla la forma completa de un `Ticket` (ver `types.ts`) a partir de las
 * filas crudas devueltas por los stored procedures: el ticket base más sus
 * comentarios, notas internas, historial y adjuntos.
 */
import db from './db';
import { fmtDate, fmtTs } from './helpers';
import { Ticket } from './types';

/**
 * Combina la fila base de un ticket con sus relaciones (comentarios, notas,
 * historial, adjuntos) en el objeto `Ticket` que consume el frontend,
 * aplicando formato de fechas y normalizando nombres para mostrar.
 * @param row Fila del ticket devuelta por `sp_GetTicket` / `sp_GetTickets`.
 * @param comments Comentarios visibles para el empleado (`es_interno = 0`).
 * @param notes Notas internas, solo visibles para staff (`es_interno = 1`).
 * @param history Entradas del historial de cambios del ticket.
 * @param attachments Adjuntos subidos al ticket.
 * @returns El ticket ensamblado, listo para responder al frontend.
 */
function shapeTicket(row: any, comments: any[], notes: any[], history: any[], attachments: any[]): Ticket {
  return {
    id:        row.id,
    title:     row.titulo,
    desc:      row.descripcion,
    status:    row.status,
    prioridad: row.prioridad,
    categoria: row.categoria,
    asignado:  (row.asignado_display || '').trim() || 'Sin asignar',
    reporter:  row.reporter_display || '',
    reporterId: row.reporter_id || null,
    fecha:     fmtDate(row.created_at),
    fechaTs:   new Date(row.created_at).getTime(),
    comments:  comments.map(c => ({ ts: fmtTs(c.created_at), user: c.autor_display, rolNivel: c.autor_rol_nivel, text: c.texto })),
    notes:     notes.map(n => ({ ts: fmtTs(n.created_at), user: n.autor_display, rolNivel: n.autor_rol_nivel, text: n.texto })),
    history:   history.map(h => ({ ts: fmtTs(h.created_at), user: h.usuario_display, accion: h.accion })),
    attachments: attachments.map(a => ({
      name: a.nombre_original,
      path: `/uploads/${a.nombre_archivo}`,
      size: a.tamano_bytes,
      ts:   fmtTs(a.created_at)
    })),
    ...(row.device_id ? { deviceId: row.device_id } : {})
  };
}

/**
 * Carga un ticket individual con todas sus relaciones.
 * @param id Folio del ticket (ej. `"TK-001"`).
 * @returns El ticket ensamblado, o `null` si no existe.
 */
async function loadTicket(id: string): Promise<Ticket | null> {
  const row = await db.execOne('sp_GetTicket', { id });
  if (!row) return null;

  const [comments, notes, history, attachments] = await Promise.all([
    db.exec('sp_GetComentarios',    { ticket_id: id, es_interno: 0 }),
    db.exec('sp_GetComentarios',    { ticket_id: id, es_interno: 1 }),
    db.exec('sp_GetHistorialTicket', { ticket_id: id }),
    db.exec('sp_GetAdjuntos',        { ticket_id: id })
  ]);

  return shapeTicket(row, comments, notes, history, attachments);
}

/**
 * Carga todos los tickets con sus relaciones, evitando el problema N+1: en
 * vez de una consulta de comentarios/notas/historial/adjuntos por ticket,
 * trae todas las relaciones de golpe (`WHERE ticket_id IN (...)`) y las
 * agrupa en memoria por `ticket_id` antes de ensamblar cada ticket.
 * @returns Todos los tickets del sistema, ensamblados con sus relaciones.
 */
async function loadAllTickets(): Promise<Ticket[]> {
  const rows = await db.exec<any>('sp_GetTickets');
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const ph  = ids.map(() => '?').join(',');

  const comentarioSelect = (esInterno: 0 | 1) => `
    SELECT c.ticket_id,
           CASE WHEN u.id IS NULL THEN c.autor_nombre
                ELSE LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) END AS autor_display,
           r.nivel AS autor_rol_nivel, c.texto, c.created_at
    FROM comentarios c
    LEFT JOIN usuarios u ON u.id = c.autor_id
    LEFT JOIN roles r ON r.id = u.rol_id
    WHERE c.ticket_id IN (${ph}) AND c.es_interno = ${esInterno}
    ORDER BY c.created_at`;

  // Las subconsultas usan IN con longitud variable — se mantienen como query inline
  const [allComs, allNotes, allHist, allAtts] = await Promise.all([
    db.query<any>(comentarioSelect(0), ids),
    db.query<any>(comentarioSelect(1), ids),
    db.query<any>(`SELECT h.ticket_id,
                     CASE WHEN u.id IS NULL THEN h.usuario_nombre
                          ELSE LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) END AS usuario_display,
                     h.accion, h.created_at
              FROM historial_tickets h
              LEFT JOIN usuarios u ON u.id = h.usuario_id
              WHERE h.ticket_id IN (${ph}) ORDER BY h.created_at`, ids),
    db.query<any>(`SELECT ticket_id, nombre_original, nombre_archivo, tamano_bytes, created_at FROM adjuntos WHERE ticket_id IN (${ph}) ORDER BY created_at`, ids)
  ]);

  const group = (arr: any[]): Record<string, any[]> => arr.reduce((acc, r) => {
    (acc[r.ticket_id] = acc[r.ticket_id] || []).push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const comsG  = group(allComs);
  const notesG = group(allNotes);
  const histG  = group(allHist);
  const attsG  = group(allAtts);

  return rows.map(r => shapeTicket(
    r,
    comsG[r.id]  || [],
    notesG[r.id] || [],
    histG[r.id]  || [],
    attsG[r.id]  || []
  ));
}

export { loadTicket, loadAllTickets };
