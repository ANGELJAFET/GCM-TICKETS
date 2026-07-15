import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db';
import { logAudit } from '../helpers';
import mailer from '../mailer';
import { loadTicket, loadAllTickets } from '../ticketLoader';
import { upload } from '../middleware/upload';
import { mobileSessions } from '../mobileSessions';
import { UPLOADS } from '../config';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
const CATEGORIAS  = ['Hardware', 'Software', 'Red', 'Acceso', 'Otro'];
const ESTADOS     = ['abierto', 'en_progreso', 'cerrado'];

// GET /api/tickets
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await loadAllTickets());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets' });
  }
});

// POST /api/tickets
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { title, desc, status, prioridad, categoria, asignado } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });
  if (status && !ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });
  if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida' });

  let ticketId: string | null = null;
  try {
    ticketId = await db.nextId('tickets', 'TK');

    let asignadoId: number | null = null;
    if (asignado && asignado !== 'Sin asignar') {
      const u = await db.findUserByNombre(asignado);
      if (u) asignadoId = u.id;
    }

    await db.query(
      `INSERT INTO tickets (id, titulo, descripcion, status, prioridad, categoria,
                            reporter_id, asignado_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, title, desc || 'Sin descripción.', status || 'abierto',
       prioridad || 'Media', categoria || 'Otro', req.user!.id, asignadoId]
    );

    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_id, accion) VALUES (?, ?, ?)',
      [ticketId, req.user!.id, `Ticket creado por ${req.user!.nombre}`]
    );

    res.status(201).json(await loadTicket(ticketId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear ticket' });
  }

  // Notificar al admin que llegó un ticket nuevo
  try {
    if (!ticketId) return;
    const adminEmail = process.env.SMTP_USER;
    if (!adminEmail) return;
    const tpl = mailer.emailTicketNuevo({ folio: ticketId, titulo: title, prioridad: prioridad || 'Media', nombre: req.user!.nombre, departamento: null });
    mailer.send({ to: adminEmail, ...tpl });
  } catch (emailErr: any) {
    console.error('[mailer] Error notificando ticket nuevo:', emailErr.message);
  }
});

// GET /api/tickets/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
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
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const id  = req.params.id;
  let row: any = null;
  try {
    row = await db.queryOne<any>('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Ticket no encontrado' });

    const labels: Record<string, string> = { status: 'Estado', asignado: 'Asignado a', prioridad: 'Prioridad',
                        categoria: 'Categoría', title: 'Título', desc: 'Descripción' };

    for (const [campo, label] of Object.entries(labels)) {
      const val = req.body[campo];
      if (val === undefined) continue;

      if (campo === 'status' && !ESTADOS.includes(val))
        return res.status(400).json({ error: 'Estado inválido' });
      if (campo === 'prioridad' && !PRIORIDADES.includes(val))
        return res.status(400).json({ error: 'Prioridad inválida' });
      if (campo === 'categoria' && !CATEGORIAS.includes(val))
        return res.status(400).json({ error: 'Categoría inválida' });

      if (campo === 'asignado') {
        let asignadoId: number | null   = null;
        let asignadoName = 'Sin asignar';
        if (val && val !== 'Sin asignar') {
          const u = await db.findUserByNombre(val);
          if (u) { asignadoId = u.id; asignadoName = u.display.trim(); }
        }
        const prevRow = await db.queryOne<any>(
          `SELECT TRIM(CONCAT(u.nombre,' ',IFNULL(u.apellido,''))) AS prev
           FROM tickets t LEFT JOIN usuarios u ON u.id = t.asignado_id WHERE t.id = ?`, [id]
        );
        const prev = (prevRow?.prev || '').trim() || 'Sin asignar';
        if (asignadoName !== prev) {
          await db.query('UPDATE tickets SET asignado_id = ?, updated_at = NOW() WHERE id = ?', [asignadoId, id]);
          await db.query(
            'INSERT INTO historial_tickets (ticket_id, usuario_id, accion, campo_modificado, valor_anterior, valor_nuevo) VALUES (?,?,?,?,?,?)',
            [id, req.user!.id, `${label} cambiado a "${asignadoName}"`, 'asignado_id', prev, asignadoName]
          );
        }
      } else {
        const colMap: Record<string, string> = { title: 'titulo', desc: 'descripcion', status: 'status',
                         prioridad: 'prioridad', categoria: 'categoria' };
        const col  = colMap[campo];
        const prev = row[col];
        if (val !== prev) {
          const extra = campo === 'status' && val === 'cerrado' ? ', closed_at = NOW()' : '';
          await db.query(`UPDATE tickets SET ${col} = ?, updated_at = NOW()${extra} WHERE id = ?`, [val, id]);
          await db.query(
            'INSERT INTO historial_tickets (ticket_id, usuario_id, accion, campo_modificado, valor_anterior, valor_nuevo) VALUES (?,?,?,?,?,?)',
            [id, req.user!.id, `${label} cambiado a "${val}"`, col, prev, val]
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
    if (!nuevoStatus || nuevoStatus === row.status) return;
    const adminEmail = process.env.SMTP_USER;
    const reporter = row.reporter_id
      ? await db.queryOne<any>('SELECT nombre, apellido, email FROM usuarios WHERE id = ?', [row.reporter_id])
      : null;
    const tpl = mailer.emailCambioEstado({
      folio:          id,
      titulo:         row.titulo,
      estadoAnterior: row.status,
      estadoNuevo:    nuevoStatus,
      nombre:         reporter ? `${reporter.nombre} ${reporter.apellido || ''}`.trim() : row.reporter_nombre,
      comentario:     req.body.comentario || null,
    });
    // Notificar al admin siempre
    if (adminEmail) mailer.send({ to: adminEmail, ...tpl });
    // Notificar al reporter si tiene email y es diferente al admin
    if (reporter?.email && reporter.email !== adminEmail) mailer.send({ to: reporter.email, ...tpl });
  } catch (emailErr: any) {
    console.error('[mailer] Error notificando cambio de estado:', emailErr.message);
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id   = req.params.id;
    const atts = await db.query<any>('SELECT nombre_archivo FROM adjuntos WHERE ticket_id = ?', [id]);
    atts.forEach(a => {
      const fp = path.join(UPLOADS, a.nombre_archivo);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    const tkt = await db.queryOne<any>('SELECT titulo, reporter_nombre FROM tickets WHERE id = ?', [id]);
    await db.query('DELETE FROM tickets WHERE id = ?', [id]);
    await logAudit(req.user!.nombre, 'Eliminó ticket', 'ticket', id,
      tkt ? `${id}: "${tkt.titulo}"` : id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!req.body.text)
      return res.status(400).json({ error: 'El texto es requerido' });

    await db.query(
      'INSERT INTO comentarios (ticket_id, autor_id, texto, es_interno) VALUES (?, ?, ?, FALSE)',
      [id, req.user!.id, req.body.text]
    );
    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_id, accion) VALUES (?, ?, ?)',
      [id, req.user!.id, 'Comentario enviado al usuario']
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

// POST /api/tickets/:id/notes
router.post('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!req.body.text)
      return res.status(400).json({ error: 'El texto es requerido' });

    await db.query(
      'INSERT INTO comentarios (ticket_id, autor_id, texto, es_interno) VALUES (?, ?, ?, TRUE)',
      [id, req.user!.id, req.body.text]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar nota' });
  }
});

// POST /api/tickets/:id/attachments
router.post('/:id/attachments', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
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
      'INSERT INTO historial_tickets (ticket_id, usuario_id, accion) VALUES (?, ?, ?)',
      [id, req.user!.id, `Archivo adjuntado: ${req.file.originalname}`]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al adjuntar archivo' });
  }
});

// POST /api/tickets/:id/attachments/from-mobile
router.post('/:id/attachments/from-mobile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const s = mobileSessions.get(token);
    if (!s || s.status !== 'ready') return res.status(400).json({ error: 'Sesión no válida o archivo no recibido' });

    const id = req.params.id;
    if (!await db.queryOne('SELECT id FROM tickets WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Ticket no encontrado' });

    const filename = path.basename(s.filePath!);
    const mime     = /\.(mp4|mov|avi|webm|3gp)$/i.test(filename) ? 'video/mp4' : 'image/jpeg';

    await db.query(
      `INSERT INTO adjuntos (ticket_id, nombre_original, nombre_archivo, ruta, tipo_mime, tamano_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, s.file!.name, filename, s.file!.path, mime, s.file!.size]
    );
    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_id, accion) VALUES (?, ?, ?)',
      [id, req.user!.id, `Archivo adjuntado (celular): ${s.file!.name}`]
    );
    await db.query('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [id]);

    mobileSessions.delete(token);
    res.json(await loadTicket(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al adjuntar archivo desde celular' });
  }
});

export default router;
