const express          = require('express');
const fs               = require('fs');
const path             = require('path');
const router           = express.Router();
const db               = require('../db');
const { logAudit }     = require('../helpers');
const mailer           = require('../mailer');
const { loadTicket, loadAllTickets } = require('../ticketLoader');
const { upload }       = require('../middleware/upload');
const { mobileSessions } = require('../mobileSessions');
const { UPLOADS }      = require('../config');

// GET /api/tickets
router.get('/', async (req, res) => {
  try {
    res.json(await loadAllTickets());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets' });
  }
});

// POST /api/tickets
router.post('/', async (req, res) => {
  const { title, desc, status, prioridad, categoria, asignado, reporter } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });

  let ticketId = null;
  try {
    ticketId = await db.nextId('tickets', 'TK');

    let asignadoId = null;
    if (asignado && asignado !== 'Sin asignar') {
      const u = await db.findUserByNombre(asignado);
      if (u) asignadoId = u.id;
    }

    await db.query(
      `INSERT INTO tickets (id, titulo, descripcion, status, prioridad, categoria,
                            reporter_nombre, asignado_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, title, desc || 'Sin descripción.', status || 'abierto',
       prioridad || 'Media', categoria || 'Otro', reporter || '', asignadoId]
    );

    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [ticketId, 'Sistema', `Ticket creado por ${reporter || 'Usuario'}`]
    );

    res.status(201).json(await loadTicket(ticketId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear ticket' });
  }

  // Notificar al usuario — bloque aislado, no afecta la respuesta ya enviada
  try {
    if (!reporter || !ticketId) return;
    const userRow = await db.queryOne(
      `SELECT email FROM usuarios
       WHERE LOWER(LTRIM(RTRIM(CONCAT(nombre,' ',ISNULL(apellido,''))))) = LOWER(?) AND activo = 1`,
      [reporter]
    );
    console.log(`[mailer] Ticket nuevo ${ticketId}: reporter="${reporter}" → email=${userRow?.email || 'sin email'}`);
    if (!userRow?.email) return;
    const tpl = mailer.emailTicketNuevo({ folio: ticketId, titulo: title, prioridad: prioridad || 'Media', nombre: reporter, departamento: null });
    mailer.send({ to: userRow.email, ...tpl });
  } catch (emailErr) {
    console.error('[mailer] Error notificando ticket nuevo:', emailErr.message);
  }
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar ticket' });
  }
});

// PATCH /api/tickets/:id
router.patch('/:id', async (req, res) => {
  const id  = req.params.id;
  let row = null;
  try {
    row = await db.queryOne('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Ticket no encontrado' });

    const adminUser = req.body.adminUser || 'Admin';
    const labels    = { status: 'Estado', asignado: 'Asignado a', prioridad: 'Prioridad',
                        categoria: 'Categoría', title: 'Título', desc: 'Descripción' };

    for (const [campo, label] of Object.entries(labels)) {
      const val = req.body[campo];
      if (val === undefined) continue;

      if (campo === 'asignado') {
        let asignadoId   = null;
        let asignadoName = 'Sin asignar';
        if (val && val !== 'Sin asignar') {
          const u = await db.findUserByNombre(val);
          if (u) { asignadoId = u.id; asignadoName = u.display.trim(); }
        }
        const prevRow = await db.queryOne(
          `SELECT TRIM(CONCAT(u.nombre,' ',IFNULL(u.apellido,''))) AS prev
           FROM tickets t LEFT JOIN usuarios u ON u.id = t.asignado_id WHERE t.id = ?`, [id]
        );
        const prev = (prevRow?.prev || '').trim() || 'Sin asignar';
        if (asignadoName !== prev) {
          await db.query('UPDATE tickets SET asignado_id = ?, updated_at = NOW() WHERE id = ?', [asignadoId, id]);
          await db.query(
            'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion, campo_modificado, valor_anterior, valor_nuevo) VALUES (?,?,?,?,?,?)',
            [id, adminUser, `${label} cambiado a "${asignadoName}"`, 'asignado_id', prev, asignadoName]
          );
        }
      } else {
        const colMap = { title: 'titulo', desc: 'descripcion', status: 'status',
                         prioridad: 'prioridad', categoria: 'categoria' };
        const col  = colMap[campo];
        const prev = row[col];
        if (val !== prev) {
          const extra = campo === 'status' && val === 'cerrado' ? ', closed_at = NOW()' : '';
          await db.query(`UPDATE tickets SET ${col} = ?, updated_at = NOW()${extra} WHERE id = ?`, [val, id]);
          await db.query(
            'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion, campo_modificado, valor_anterior, valor_nuevo) VALUES (?,?,?,?,?,?)',
            [id, adminUser, `${label} cambiado a "${val}"`, col, prev, val]
          );
        }
      }
    }

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar ticket' });
  }

  // Notificar cambio de estado — bloque aislado
  try {
    const nuevoStatus = req.body.status;
    if (!nuevoStatus || nuevoStatus === row.status || !row.reporter_nombre) return;
    const reporterRow = await db.queryOne(
      `SELECT email FROM usuarios
       WHERE LOWER(LTRIM(RTRIM(CONCAT(nombre,' ',ISNULL(apellido,''))))) = LOWER(?) AND activo = 1`,
      [row.reporter_nombre]
    );
    console.log(`[mailer] Estado ${id}: "${row.status}"→"${nuevoStatus}" reporter="${row.reporter_nombre}" → email=${reporterRow?.email || 'sin email'}`);
    if (!reporterRow?.email) return;
    const tpl = mailer.emailCambioEstado({
      folio:          id,
      titulo:         row.titulo,
      estadoAnterior: row.status,
      estadoNuevo:    nuevoStatus,
      nombre:         row.reporter_nombre,
      comentario:     req.body.comentario || null,
    });
    mailer.send({ to: reporterRow.email, ...tpl });
  } catch (emailErr) {
    console.error('[mailer] Error notificando cambio de estado:', emailErr.message);
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', async (req, res) => {
  try {
    const id   = req.params.id;
    const atts = await db.query('SELECT nombre_archivo FROM adjuntos WHERE ticket_id = ?', [id]);
    atts.forEach(a => {
      const fp = path.join(UPLOADS, a.nombre_archivo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    const tkt = await db.queryOne('SELECT titulo, reporter_nombre FROM tickets WHERE id = ?', [id]);
    await db.query('DELETE FROM tickets WHERE id = ?', [id]);
    await logAudit(req.body?.adminUser || null, 'Eliminó ticket', 'ticket', id,
      tkt ? `${id}: "${tkt.titulo}" · ${tkt.reporter_nombre}` : id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!req.body.text)
      return res.status(400).json({ error: 'El texto es requerido' });

    const autor = req.body.adminUser || 'Soporte';
    await db.query(
      'INSERT INTO comentarios (ticket_id, autor_nombre, texto, es_interno) VALUES (?, ?, ?, FALSE)',
      [id, autor, req.body.text]
    );
    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [id, autor, 'Comentario enviado al usuario']
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

// POST /api/tickets/:id/notes
router.post('/:id/notes', async (req, res) => {
  try {
    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!req.body.text)
      return res.status(400).json({ error: 'El texto es requerido' });

    await db.query(
      'INSERT INTO comentarios (ticket_id, autor_nombre, texto, es_interno) VALUES (?, ?, ?, TRUE)',
      [id, req.body.user || 'Admin', req.body.text]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar nota' });
  }
});

// POST /api/tickets/:id/attachments
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!req.file)
      return res.status(400).json({ error: 'No se recibió archivo' });

    await db.query(
      `INSERT INTO adjuntos (ticket_id, nombre_original, nombre_archivo, ruta, tipo_mime, tamano_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.file.originalname, req.file.filename,
       `/uploads/${req.file.filename}`, req.file.mimetype, req.file.size]
    );
    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [id, req.body.uploader || 'Usuario', `Archivo adjuntado: ${req.file.originalname}`]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al adjuntar archivo' });
  }
});

// POST /api/tickets/:id/attachments/from-mobile
router.post('/:id/attachments/from-mobile', async (req, res) => {
  try {
    const { token, uploader } = req.body;
    const s = mobileSessions.get(token);
    if (!s || s.status !== 'ready') return res.status(400).json({ error: 'Sesión no válida o archivo no recibido' });

    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });

    const filename = path.basename(s.filePath);
    const mime     = /\.(mp4|mov|avi|webm|3gp)$/i.test(filename) ? 'video/mp4' : 'image/jpeg';

    await db.query(
      `INSERT INTO adjuntos (ticket_id, nombre_original, nombre_archivo, ruta, tipo_mime, tamano_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, s.file.name, filename, s.file.path, mime, s.file.size]
    );
    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [id, uploader || 'Usuario', `Archivo adjuntado (celular): ${s.file.name}`]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    mobileSessions.delete(token);
    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al adjuntar archivo desde celular' });
  }
});

module.exports = router;
