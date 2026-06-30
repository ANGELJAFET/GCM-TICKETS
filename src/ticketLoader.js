const db = require('./db');
const { fmtDate, fmtTs } = require('./helpers');

function shapeTicket(row, comments, notes, history, attachments) {
  return {
    id:        row.id,
    title:     row.titulo,
    desc:      row.descripcion,
    status:    row.status,
    prioridad: row.prioridad,
    categoria: row.categoria,
    asignado:  (row.asignado_display || '').trim() || 'Sin asignar',
    reporter:  row.reporter_nombre || '',
    fecha:     fmtDate(row.created_at),
    fechaTs:   new Date(row.created_at).getTime(),
    comments:  comments.map(c => c.texto),
    notes:     notes.map(n => ({ ts: fmtTs(n.created_at), user: n.autor_nombre, text: n.texto })),
    history:   history.map(h => ({ ts: fmtTs(h.created_at), user: h.usuario_nombre, accion: h.accion })),
    attachments: attachments.map(a => ({
      name: a.nombre_original,
      path: `/uploads/${a.nombre_archivo}`,
      size: a.tamano_bytes,
      ts:   fmtTs(a.created_at)
    })),
    ...(row.device_id ? { deviceId: row.device_id } : {})
  };
}

async function loadTicket(id) {
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

async function loadAllTickets() {
  const rows = await db.exec('sp_GetTickets');
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const ph  = ids.map(() => '?').join(',');

  // Las subconsultas usan IN con longitud variable — se mantienen como query inline
  const [allComs, allNotes, allHist, allAtts] = await Promise.all([
    db.query(`SELECT ticket_id, autor_nombre, texto, created_at FROM comentarios WHERE ticket_id IN (${ph}) AND es_interno = FALSE ORDER BY created_at`, ids),
    db.query(`SELECT ticket_id, autor_nombre, texto, created_at FROM comentarios WHERE ticket_id IN (${ph}) AND es_interno = TRUE  ORDER BY created_at`, ids),
    db.query(`SELECT ticket_id, usuario_nombre, accion, created_at FROM historial_tickets WHERE ticket_id IN (${ph}) ORDER BY created_at`, ids),
    db.query(`SELECT ticket_id, nombre_original, nombre_archivo, tamano_bytes, created_at FROM adjuntos WHERE ticket_id IN (${ph}) ORDER BY created_at`, ids)
  ]);

  const group = (arr) => arr.reduce((acc, r) => {
    (acc[r.ticket_id] = acc[r.ticket_id] || []).push(r);
    return acc;
  }, {});

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

module.exports = { loadTicket, loadAllTickets };
