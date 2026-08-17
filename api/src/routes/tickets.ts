/**
 * CRUD de tickets de soporte técnico: listado/consulta, creación, edición de
 * campos con historial, comentarios (visibles al empleado), notas internas
 * (solo staff) y adjuntos (subida directa o vía sesión móvil por QR).
 * Montado en `server.ts` bajo el prefijo `/api/tickets`.
 */
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
import { requireAuth, requireRole } from '../middleware/auth';
import { Ticket } from '../types';

const router = express.Router();

const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
const CATEGORIAS  = ['Hardware', 'Software', 'Red', 'Acceso', 'Otro'];
const ESTADOS     = ['abierto', 'en_progreso', 'cerrado'];

// Empleados (rol_nivel 1) solo ven/operan sus propios tickets y nunca las
// notas internas de staff; técnicos/admins/superadmin (nivel >= 2) ven todo.
const isStaff = (user: { rol_nivel: number }) => user.rol_nivel >= 2;

/** Oculta las notas internas de staff a un ticket cuando quien lo consulta no es staff. */
function sanitizeForRequester(ticket: Ticket, user: { rol_nivel: number }): Ticket {
  return isStaff(user) ? ticket : { ...ticket, notes: [] };
}

/**
 * GET /api/tickets
 * Lista tickets. Un empleado (rol_nivel 1) solo ve sus propios tickets (por
 * `reporterId`) y nunca las notas internas; staff (rol_nivel >= 2) ve todos
 * los tickets completos.
 *
 * Auth: requiere sesión (cualquier rol).
 *
 * Respuesta 200: `Ticket[]` (ver `types.ts`).
 *
 * Códigos de estado:
 * - 200 — listado cargado correctamente.
 * - 401 — sin sesión válida.
 * - 500 — error al cargar tickets.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    let tickets = await loadAllTickets();
    if (!isStaff(req.user!)) {
      tickets = tickets
        .filter(t => t.reporterId === req.user!.id)
        .map(t => sanitizeForRequester(t, req.user!));
    }
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets' });
  }
});

/**
 * POST /api/tickets
 * Crea un ticket nuevo, asignado al usuario autenticado como `reporter`.
 * Genera el folio con `db.nextId('tickets', 'TK')` (ej. `TK-001`) y registra
 * la creación en el historial del ticket. Notifica por correo al
 * administrador (best-effort: un fallo de envío no afecta la respuesta ya enviada).
 *
 * Auth: requiere sesión (cualquier rol).
 *
 * Body: `{ title: string, desc?: string, status?: string, prioridad?: string, categoria?: string, asignado?: string }`
 * - `status`: uno de `'abierto' | 'en_progreso' | 'cerrado'` (default `'abierto'`).
 * - `prioridad`: uno de `'Baja' | 'Media' | 'Alta' | 'Crítica'` (default `'Media'`).
 * - `categoria`: uno de `'Hardware' | 'Software' | 'Red' | 'Acceso' | 'Otro'` (default `'Otro'`).
 * - `asignado`: nombre completo o username del técnico a asignar (resuelto vía `db.findUserByNombre`); se ignora si no coincide con nadie.
 *
 * Respuesta 201: el `Ticket` creado, ya ensamblado con sus relaciones (vacías).
 *
 * Códigos de estado:
 * - 201 — ticket creado.
 * - 400 — falta `title`, o `status`/`prioridad`/`categoria` no son valores válidos.
 * - 500 — error al crear el ticket.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { title, desc, status, prioridad, categoria, asignado } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });
  if (status && !ESTADOS.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });
  if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoría inválida' });

  let ticketId: string | null = null;
  try {
    let asignadoId: number | null = null;
    if (asignado && asignado !== 'Sin asignar') {
      const u = await db.findUserByNombre(asignado);
      if (u) asignadoId = u.id;
    }

    // El folio (nextId), el INSERT del ticket y su primera entrada de historial
    // van en una transacción: si algo falla no queda un folio "quemado" sin
    // ticket, ni un ticket sin su historial inicial.
    ticketId = await db.withTransaction(async (tx) => {
      const id = await tx.nextId('tickets', 'TK');
      await tx.query(
        `INSERT INTO tickets (id, titulo, descripcion, status, prioridad, categoria,
                              reporter_id, asignado_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, desc || 'Sin descripción.', status || 'abierto',
         prioridad || 'Media', categoria || 'Otro', req.user!.id, asignadoId]
      );
      await tx.query(
        'INSERT INTO historial_tickets (ticket_id, usuario_id, accion) VALUES (?, ?, ?)',
        [id, req.user!.id, `Ticket creado por ${req.user!.nombre}`]
      );
      return id;
    });

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

/**
 * GET /api/tickets/:id
 * Consulta un ticket individual. Un empleado que no es dueño del ticket
 * recibe `404` (no `403`), para no confirmarle que un ticket ajeno existe.
 *
 * Auth: requiere sesión (cualquier rol).
 *
 * Parámetros de ruta: `id` — folio del ticket (ej. `TK-001`).
 *
 * Respuesta 200: el `Ticket` (sin `notes` si quien consulta no es staff).
 *
 * Códigos de estado:
 * - 200 — ticket encontrado.
 * - 404 — el ticket no existe, o pertenece a otro empleado que no es staff.
 * - 500 — error al cargar el ticket.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ticket = await loadTicket(req.params.id);
    // 404 (no 403) para no confirmarle a un empleado que un ticket ajeno existe.
    if (!ticket || (!isStaff(req.user!) && ticket.reporterId !== req.user!.id))
      return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(sanitizeForRequester(ticket, req.user!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar ticket' });
  }
});

/**
 * PATCH /api/tickets/:id
 * Actualiza uno o más campos del ticket (edición parcial). Solo staff
 * (técnico/admin/superadmin) puede gestionar tickets. Cada campo que
 * realmente cambia queda registrado en `historial_tickets`. Si notifica al
 * `status`, envía un correo de cambio de estado al reporter y al admin
 * (best-effort).
 *
 * Auth: requiere `rol_nivel >= 2`.
 *
 * Parámetros de ruta: `id` — folio del ticket.
 *
 * Body (todos opcionales, se aplican solo los presentes): `{ title?, desc?, status?, prioridad?, categoria?, asignado?, comentario? }`
 * - `asignado`: nombre completo o username del técnico, o `'Sin asignar'`.
 * - `comentario`: texto opcional incluido en el correo de cambio de estado (no se guarda en el ticket).
 *
 * Respuesta 200: el `Ticket` actualizado.
 *
 * Códigos de estado:
 * - 200 — actualizado correctamente.
 * - 400 — `status`/`prioridad`/`categoria` con un valor no permitido.
 * - 403 — el usuario autenticado no es staff.
 * - 404 — el ticket no existe.
 * - 500 — error al actualizar.
 */
router.patch('/:id', ...requireRole(2), async (req: Request, res: Response) => {
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

/**
 * DELETE /api/tickets/:id
 * Elimina un ticket, sus adjuntos en disco y registra la acción en la
 * bitácora de auditoría.
 *
 * Auth: requiere `rol_nivel >= 2`.
 *
 * Parámetros de ruta: `id` — folio del ticket.
 *
 * Respuesta 200: `{ ok: true }`
 *
 * Códigos de estado:
 * - 200 — eliminado correctamente.
 * - 403 — el usuario autenticado no es staff.
 * - 500 — error al eliminar.
 */
router.delete('/:id', ...requireRole(2), async (req: Request, res: Response) => {
  try {
    const id   = req.params.id;
    const atts = await db.query<any>('SELECT nombre_archivo FROM adjuntos WHERE ticket_id = ?', [id]);
    const tkt  = await db.queryOne<any>('SELECT titulo, reporter_nombre FROM tickets WHERE id = ?', [id]);

    // Primero se borra en BD (esto elimina en cascada adjuntos/comentarios/
    // historial). Los archivos del disco se borran DESPUÉS de confirmar el
    // DELETE, y de forma asíncrona (no bloquea el event loop). Así, si el
    // DELETE fallara, los archivos seguirían intactos en vez de quedar
    // huérfanos apuntados por un ticket que no se borró.
    await db.query('DELETE FROM tickets WHERE id = ?', [id]);
    await Promise.all(atts.map(a => fs.promises.unlink(path.join(UPLOADS, a.nombre_archivo)).catch(() => {})));

    await logAudit(req.user!.nombre, 'Eliminó ticket', 'ticket', id,
      tkt ? `${id}: "${tkt.titulo}"` : id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
});

/**
 * POST /api/tickets/:id/comments
 * Agrega un comentario visible para el empleado (canal público del ticket).
 * Puede comentar el dueño del ticket o cualquier miembro de staff.
 *
 * Auth: requiere sesión (cualquier rol).
 *
 * Parámetros de ruta: `id` — folio del ticket.
 * Body: `{ text: string }`
 *
 * Respuesta 200: el `Ticket` actualizado (con el nuevo comentario incluido).
 *
 * Códigos de estado:
 * - 200 — comentario agregado.
 * - 400 — falta `text`.
 * - 404 — el ticket no existe, o pertenece a otro empleado que no es staff.
 * - 500 — error al agregar el comentario.
 */
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const tkt = await db.queryOne<any>('SELECT reporter_id FROM tickets WHERE id = ?', [id]);
    if (!tkt) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!isStaff(req.user!) && tkt.reporter_id !== req.user!.id)
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

/**
 * POST /api/tickets/:id/notes
 * Agrega una nota interna, visible solo para staff (nunca para el empleado
 * dueño del ticket).
 *
 * Auth: requiere `rol_nivel >= 2`.
 *
 * Parámetros de ruta: `id` — folio del ticket.
 * Body: `{ text: string }`
 *
 * Respuesta 200: el `Ticket` actualizado (con la nueva nota incluida).
 *
 * Códigos de estado:
 * - 200 — nota agregada.
 * - 400 — falta `text`.
 * - 403 — el usuario autenticado no es staff.
 * - 404 — el ticket no existe.
 * - 500 — error al agregar la nota.
 */
router.post('/:id/notes', ...requireRole(2), async (req: Request, res: Response) => {
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

/**
 * POST /api/tickets/:id/attachments
 * Sube un adjunto (imagen/video/documento, máx. 50 MB) directamente al
 * ticket usando `multipart/form-data`. Puede subir el dueño del ticket o
 * cualquier miembro de staff.
 *
 * Auth: requiere sesión (cualquier rol).
 *
 * Parámetros de ruta: `id` — folio del ticket.
 * Body: `multipart/form-data` con campo `file` (ver `middleware/upload.ts`).
 *
 * Respuesta 200: el `Ticket` actualizado (con el nuevo adjunto incluido).
 *
 * Códigos de estado:
 * - 200 — archivo adjuntado.
 * - 400 — no se recibió archivo (`req.file` vacío o extensión no permitida).
 * - 404 — el ticket no existe, o pertenece a otro empleado que no es staff.
 * - 500 — error al adjuntar el archivo.
 */
router.post('/:id/attachments', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const tkt = await db.queryOne<any>('SELECT reporter_id FROM tickets WHERE id = ?', [id]);
    if (!tkt) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!isStaff(req.user!) && tkt.reporter_id !== req.user!.id)
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

/**
 * POST /api/tickets/:id/attachments/from-mobile
 * Adjunta al ticket un archivo que ya fue subido por celular a través del
 * flujo de sesión móvil por QR (ver `mobileSessions.ts` y `routes/mobileUpload.ts`).
 * La sesión debe existir y estar en estado `'ready'` (archivo ya recibido).
 *
 * Auth: requiere sesión (cualquier rol) — quien confirma el adjunto desde el
 * navegador ya tiene sesión iniciada; el celular que subió el archivo no la necesitó.
 *
 * Parámetros de ruta: `id` — folio del ticket.
 * Body: `{ token: string }` — token de la sesión móvil generada al crear el QR.
 *
 * Respuesta 200: el `Ticket` actualizado (con el nuevo adjunto incluido).
 *
 * Códigos de estado:
 * - 200 — archivo adjuntado y sesión móvil consumida (se borra del mapa en memoria).
 * - 400 — la sesión no existe o el archivo aún no ha sido recibido.
 * - 404 — el ticket no existe, o pertenece a otro empleado que no es staff.
 * - 500 — error al adjuntar el archivo.
 */
router.post('/:id/attachments/from-mobile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const s = mobileSessions.get(token);
    if (!s || s.status !== 'ready') return res.status(400).json({ error: 'Sesión no válida o archivo no recibido' });

    const id = req.params.id;
    const tkt = await db.queryOne<any>('SELECT reporter_id FROM tickets WHERE id = ?', [id]);
    if (!tkt) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!isStaff(req.user!) && tkt.reporter_id !== req.user!.id)
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
