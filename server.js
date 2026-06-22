require('dotenv').config();
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const crypto   = require('crypto');
const multer   = require('multer');
const QRCode   = require('qrcode');
const db         = require('./db');

const app    = express();
const PORT   = parseInt(process.env.PORT || '3000');
const UPLOADS = path.join(__dirname, 'uploads');
const PUBLIC  = path.join(__dirname, 'public');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

// ── Subida de archivos ────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  }
});
const ALLOWED_MEDIA = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|3gp)$/i;
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

// ── Mobile upload sessions (in-memory) ───────────────────────────────────────
const mobileSessions = new Map();
const SESSION_TTL    = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, s] of mobileSessions) {
    if (s.expiresAt < now) {
      if (s.filePath && fs.existsSync(s.filePath)) fs.unlink(s.filePath, () => {});
      mobileSessions.delete(token);
    }
  }
}, 60_000);

const mobileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `mob-${req.params.token}-${Date.now()}${ext}`);
  }
});
const mobileUpload = multer({
  storage: mobileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MEDIA.test(file.originalname))
});

// ── Formato de fechas ─────────────────────────────────────────────────────────
async function logAudit(actor, accion, entidad, entidadId, detalle) {
  try {
    await db.query(
      'INSERT INTO auditoria (actor, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
      [actor || null, accion, entidad || null, entidadId ? String(entidadId) : null, detalle || null]
    );
  } catch (err) {
    console.error('logAudit:', err.message);
  }
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}
function fmtTs(d) {
  return new Date(d).toLocaleString('es-HN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

async function loadTicket(id) {
  const row = await db.queryOne(
    `SELECT t.*,
            TRIM(CONCAT(a.nombre,' ',IFNULL(a.apellido,''))) AS asignado_display,
            a.username AS asignado_username
     FROM tickets t
     LEFT JOIN usuarios a ON a.id = t.asignado_id
     WHERE t.id = ?`,
    [id]
  );
  if (!row) return null;

  const [comments, notes, history, attachments] = await Promise.all([
    db.query('SELECT autor_nombre, texto, created_at FROM comentarios WHERE ticket_id = ? AND es_interno = FALSE ORDER BY created_at', [id]),
    db.query('SELECT autor_nombre, texto, created_at FROM comentarios WHERE ticket_id = ? AND es_interno = TRUE  ORDER BY created_at', [id]),
    db.query('SELECT usuario_nombre, accion, created_at FROM historial_tickets WHERE ticket_id = ? ORDER BY created_at', [id]),
    db.query('SELECT nombre_original, nombre_archivo, tamano_bytes, created_at FROM adjuntos WHERE ticket_id = ? ORDER BY created_at', [id])
  ]);

  return shapeTicket(row, comments, notes, history, attachments);
}

async function loadAllTickets() {
  const rows = await db.query(
    `SELECT t.*,
            TRIM(CONCAT(a.nombre,' ',IFNULL(a.apellido,''))) AS asignado_display,
            a.username AS asignado_username
     FROM tickets t
     LEFT JOIN usuarios a ON a.id = t.asignado_id
     ORDER BY t.created_at DESC`
  );
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const ph  = ids.map(() => '?').join(',');

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

function shapeTicket(row, comments, notes, history, attachments) {
  return {
    id:       row.id,
    title:    row.titulo,
    desc:     row.descripcion,
    status:   row.status,
    prioridad: row.prioridad,
    categoria: row.categoria,
    asignado: (row.asignado_display || '').trim() || 'Sin asignar',
    reporter: row.reporter_nombre || '',
    fecha:    fmtDate(row.created_at),
    fechaTs:  new Date(row.created_at).getTime(),
    comments: comments.map(c  => `${c.autor_nombre} (${fmtTime(c.created_at)}): ${c.texto}`),
    notes:    notes.map(n    => ({ ts: fmtTs(n.created_at), user: n.autor_nombre, text: n.texto })),
    history:  history.map(h  => ({ ts: fmtTs(h.created_at), user: h.usuario_nombre, accion: h.accion })),
    attachments: attachments.map(a => ({
      name: a.nombre_original,
      path: `/uploads/${a.nombre_archivo}`,
      size: a.tamano_bytes,
      ts:   fmtTs(a.created_at)
    })),
    ...(row.device_id ? { deviceId: row.device_id } : {})
  };
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  let fallback = null;
  for (const name of Object.keys(nets)) {
    if (/vmware|vmnet|virtual|hyper|vethernet|loopback/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (net.address.startsWith('10.')) return net.address;
      if (!fallback) fallback = net.address;
    }
  }
  if (fallback) return fallback;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(PUBLIC));

// Evitar que el navegador cachee respuestas de la API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});
app.use('/uploads', express.static(UPLOADS));

// ── API: Tickets ──────────────────────────────────────────────────────────────
app.get('/api/tickets', async (req, res) => {
  try {
    res.json(await loadAllTickets());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets' });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const { title, desc, status, prioridad, categoria, asignado, reporter } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });

    const id = await db.nextId('tickets', 'TK');

    let asignadoId = null;
    let asignadoDisplay = 'Sin asignar';
    if (asignado && asignado !== 'Sin asignar') {
      const u = await db.findUserByNombre(asignado);
      if (u) { asignadoId = u.id; asignadoDisplay = u.display.trim(); }
    }

    await db.query(
      `INSERT INTO tickets (id, titulo, descripcion, status, prioridad, categoria,
                            reporter_nombre, asignado_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, desc || 'Sin descripción.', status || 'abierto',
       prioridad || 'Media', categoria || 'Otro', reporter || '', asignadoId]
    );

    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [id, 'Sistema', `Ticket creado por ${reporter || 'Usuario'}`]
    );

    const ticket = await loadTicket(id);
    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar ticket' });
  }
});

app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const id  = req.params.id;
    const row = await db.queryOne('SELECT * FROM tickets WHERE id = ?', [id]);
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
        const col    = colMap[campo];
        const prev   = row[col];
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
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
});

app.post('/api/tickets/:id/comments', async (req, res) => {
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

app.post('/api/tickets/:id/notes', async (req, res) => {
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

app.post('/api/tickets/:id/attachments', upload.single('file'), async (req, res) => {
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

app.delete('/api/tickets/:id', async (req, res) => {
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

// ── API: Devices (recepción de equipo) ───────────────────────────────────────
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await db.query(
      `SELECT d.*, TRIM(CONCAT(u.nombre,' ',IFNULL(u.apellido,''))) AS tecnico_display
       FROM dispositivos d LEFT JOIN usuarios u ON u.id = d.tecnico_id
       ORDER BY d.created_at DESC`
    );
    res.json(devices.map(d => ({
      id: d.id, tipo: d.tipo, marca: d.marca, modelo: d.modelo,
      serie: d.numero_serie, estadoFisico: d.estado_fisico,
      fallaCliente: d.falla_cliente, accesorios: d.accesorios || [],
      clienteNombre: d.cliente_nombre, clienteTel: d.cliente_tel,
      tecnico: (d.tecnico_display || '').trim() || 'Sin asignar',
      fecha: fmtDate(d.created_at), fechaTs: new Date(d.created_at).getTime(),
      ticketId: d.ticket_id
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar dispositivos' });
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    const { tipo, marca, modelo, serie, estadoFisico, fallaCliente,
            accesorios, clienteNombre, clienteTel, tecnico } = req.body;

    if (!tipo || !marca || !clienteNombre || !fallaCliente)
      return res.status(400).json({ error: 'Tipo, marca, nombre del cliente y falla son requeridos' });

    const devId    = await db.nextId('dispositivos', 'DEV');
    const ticketId = await db.nextId('tickets', 'TK');

    let tecnicoId      = null;
    let tecnicoDisplay = 'Sin asignar';
    if (tecnico && tecnico !== 'Sin asignar') {
      const u = await db.findUserByNombre(tecnico);
      if (u) { tecnicoId = u.id; tecnicoDisplay = u.display.trim(); }
    }

    const estadoNombre = { excelente:'Excelente', bueno:'Bueno', regular:'Regular', danado:'Dañado' }[estadoFisico] || estadoFisico;
    const serieText    = serie ? `\nN° de serie: ${serie}` : '';
    const accArr       = Array.isArray(accesorios) ? accesorios : [];
    const accText      = accArr.length ? `\n\nAccesorios entregados: ${accArr.join(', ')}` : '';
    const telText      = clienteTel ? ` · Tel: ${clienteTel}` : '';
    const desc = `Equipo recibido para diagnóstico y reparación.\n\nDispositivo: ${tipo} ${marca} ${modelo || ''}${serieText}\nEstado físico: ${estadoNombre}\n\nFalla reportada por el cliente:\n"${fallaCliente}"${accText}`;

    await db.query(
      `INSERT INTO dispositivos (id, ticket_id, tipo, marca, modelo, numero_serie, estado_fisico,
                                 falla_cliente, accesorios, cliente_nombre, cliente_tel, tecnico_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [devId, ticketId, tipo, marca, modelo || '', serie || '',
       estadoFisico || 'bueno', fallaCliente, JSON.stringify(accArr),
       clienteNombre, clienteTel || '', tecnicoId]
    );

    await db.query(
      `INSERT INTO tickets (id, titulo, descripcion, status, prioridad, categoria,
                            reporter_nombre, asignado_id, device_id)
       VALUES (?, ?, ?, 'abierto', 'Media', 'Hardware', ?, ?, ?)`,
      [ticketId, `Recepción: ${marca} ${modelo || tipo}`.trim(),
       desc, `${clienteNombre}${telText}`, tecnicoId, devId]
    );

    await db.query(
      'INSERT INTO historial_tickets (ticket_id, usuario_nombre, accion) VALUES (?, ?, ?)',
      [ticketId, tecnicoDisplay, `Equipo recibido de ${clienteNombre}. ID dispositivo: ${devId}`]
    );

    res.status(201).json({
      device: (await db.queryOne('SELECT * FROM dispositivos WHERE id = ?', [devId])),
      ticket: await loadTicket(ticketId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
});

// ── API: Inventory ────────────────────────────────────────────────────────────
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await db.query(
      `SELECT i.*, TRIM(CONCAT(u.nombre,' ',IFNULL(u.apellido,''))) AS responsable_display
       FROM inventario i LEFT JOIN usuarios u ON u.id = i.responsable_id
       ORDER BY i.created_at DESC`
    );
    res.json(items.map(i => ({
      id: i.id, tipo: i.tipo, marca: i.marca, modelo: i.modelo,
      serie: i.numero_serie, color: i.color,
      condicion: i.condicion, estado: i.estado,
      ubicacion: i.ubicacion,
      responsable: (i.responsable_display || '').trim() || '',
      notas: i.notas, garantia: i.garantia ? JSON.parse(i.garantia) : null,
      fechaIngreso: i.fecha_ingreso ? fmtDate(i.fecha_ingreso) : fmtDate(i.created_at),
      fechaTs: new Date(i.created_at).getTime(),
      historial: []
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar inventario' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { tipo, marca, modelo, serie, color, condicion, ubicacion, responsable, notas, garantia } = req.body;
    if (!tipo || !marca) return res.status(400).json({ error: 'Tipo y marca son requeridos' });

    const id = await db.nextId('inventario', 'INV');

    let responsableId = null;
    if (responsable) {
      const u = await db.findUserByNombre(responsable);
      if (u) responsableId = u.id;
    }

    await db.query(
      `INSERT INTO inventario (id, tipo, marca, modelo, numero_serie, color, condicion,
                               estado, ubicacion, responsable_id, notas, garantia, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'disponible', ?, ?, ?, ?, CURDATE())`,
      [id, tipo, marca, modelo || '', serie || '', color || '',
       condicion || 'bueno', ubicacion || '', responsableId,
       notas || '', garantia ? JSON.stringify(garantia) : null]
    );

    await db.query(
      'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
      [id, 'Equipo registrado en inventario']
    );
    await logAudit(req.body.adminUser || null, 'Agregó equipo al inventario', 'inventario', id,
      `${id}: ${tipo} ${marca}${modelo ? ' ' + modelo : ''}`);

    res.status(201).json({ id, tipo, marca, modelo, serie, color, condicion,
      estado: 'disponible', ubicacion, responsable, notas, garantia, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar equipo' });
  }
});

app.patch('/api/inventory/:id', async (req, res) => {
  try {
    const id   = req.params.id;
    const item = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [id]);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    if (item.estado === 'en_prestamo' && req.body.estado !== undefined && req.body.estado !== 'en_prestamo')
      return res.status(409).json({ error: 'El equipo está prestado. Gestiona la devolución desde la sección Préstamos.' });

    const ESTADO_NAMES = { disponible:'Disponible', en_uso:'En uso', en_prestamo:'En préstamo',
                           en_reparacion:'En reparación', de_baja:'De baja' };

    const campos = ['tipo','marca','modelo','numero_serie','color','condicion','estado','ubicacion','notas','garantia'];
    const sets   = [];
    const vals   = [];

    for (const campo of campos) {
      const key = campo === 'numero_serie' ? 'serie' : campo;
      if (req.body[key] !== undefined) {
        sets.push(`${campo} = ?`);
        vals.push(campo === 'garantia'
          ? (req.body[key] ? JSON.stringify(req.body[key]) : null)
          : req.body[key]);

        if (campo === 'estado' && req.body[key] !== item.estado) {
          await db.query(
            'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
            [id, `Estado cambiado a "${ESTADO_NAMES[req.body[key]] || req.body[key]}"`]
          );
        }
      }
    }

    if (req.body.responsable !== undefined) {
      let rid = null;
      if (req.body.responsable) {
        const u = await db.findUserByNombre(req.body.responsable);
        if (u) rid = u.id;
      }
      sets.push('responsable_id = ?');
      vals.push(rid);
    }

    if (sets.length) {
      vals.push(id);
      await db.query(`UPDATE inventario SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
    }

    const updated = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [id]);
    if (sets.length) {
      await logAudit(req.body.adminUser || null, 'Editó equipo del inventario', 'inventario', id,
        `${id}: campos modificados — ${sets.map(s => s.split(' =')[0]).join(', ')}`);
    }
    res.json({ ...updated, garantia: updated.garantia ? JSON.parse(updated.garantia) : null, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar equipo' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const inv = await db.queryOne('SELECT tipo, marca, modelo FROM inventario WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM inventario WHERE id = ?', [req.params.id]);
    await logAudit(req.body?.adminUser || null, 'Eliminó equipo del inventario', 'inventario', req.params.id,
      inv ? `${req.params.id}: ${inv.tipo} ${inv.marca} ${inv.modelo || ''}`.trim() : req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

// ── API: Loans (préstamos) ────────────────────────────────────────────────────
app.get('/api/loans', async (req, res) => {
  try {
    const loans = await db.query(
      `SELECT p.*,
              CONCAT(i.marca,' ',IFNULL(i.modelo,i.tipo)) AS equipoDesc,
              TRIM(CONCAT(e.nombre,' ',IFNULL(e.apellido,''))) AS empleado_display
       FROM prestamos p
       JOIN inventario i ON i.id = p.inventario_id
       LEFT JOIN usuarios e ON e.id = p.empleado_id
       ORDER BY p.created_at DESC`
    );
    res.json(loans.map(l => ({
      id: l.id,
      inventoryId: l.inventario_id,
      empleado: l.empleado_display?.trim() || l.empleado_nombre || '',
      departamento: l.departamento,
      fechaPrestamo: fmtDate(l.fecha_prestamo),
      fechaPrestamoTs: new Date(l.fecha_prestamo).getTime(),
      fechaDevolucionEstimada: l.fecha_devolucion_estimada ? fmtDate(l.fecha_devolucion_estimada) : '',
      fechaDevolucionReal: l.fecha_devolucion_real ? fmtDate(l.fecha_devolucion_real) : null,
      estado: l.estado,
      autorizadoPor: l.autorizado_por_id || '',
      notas: l.notas,
      equipoDesc: l.equipoDesc
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar préstamos' });
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    const { inventoryId, empleado, departamento, fechaDevolucion, autorizadoPor, notas } = req.body;
    if (!inventoryId || !empleado)
      return res.status(400).json({ error: 'inventoryId y empleado son requeridos' });

    const item = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [inventoryId]);
    if (!item) return res.status(404).json({ error: 'Equipo no encontrado en inventario' });
    if (item.estado === 'en_prestamo') return res.status(409).json({ error: 'El equipo ya está prestado' });

    const id = await db.nextId('prestamos', 'PREST');

    let empleadoId = null;
    const u = await db.findUserByNombre(empleado);
    if (u) empleadoId = u.id;

    let autorizadoId = null;
    if (autorizadoPor) {
      const au = await db.findUserByNombre(autorizadoPor);
      if (au) autorizadoId = au.id;
    }

    await db.query(
      `INSERT INTO prestamos (id, inventario_id, empleado_id, empleado_nombre, departamento,
                              fecha_prestamo, fecha_devolucion_estimada, estado, autorizado_por_id, notas)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 'activo', ?, ?)`,
      [id, inventoryId, empleadoId, empleado, departamento || '',
       fechaDevolucion || null, autorizadoId, notas || '']
    );

    await db.query(
      `UPDATE inventario SET estado = 'en_prestamo', responsable_id = ?, updated_at = NOW() WHERE id = ?`,
      [empleadoId, inventoryId]
    );

    await db.query(
      'INSERT INTO historial_inventario (inventario_id, usuario_id, accion) VALUES (?, ?, ?)',
      [inventoryId, empleadoId, `Préstamo ${id} — ${empleado}`]
    );

    const loan = await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]);
    const inv  = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [inventoryId]);
    await logAudit(req.body.adminUser || autorizadoPor || null,
      'Registró préstamo', 'prestamo', id,
      `${id}: ${inventoryId} → ${empleado}${departamento ? ' (' + departamento + ')' : ''}`);
    res.status(201).json({ loan, item: inv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
  }
});

app.patch('/api/loans/:id', async (req, res) => {
  try {
    const id   = req.params.id;
    const loan = await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]);
    if (!loan) return res.status(404).json({ error: 'Préstamo no encontrado' });

    if (req.body.estado === 'devuelto' && loan.estado !== 'devuelto') {
      await db.query(
        `UPDATE prestamos SET estado = 'devuelto', fecha_devolucion_real = NOW() WHERE id = ?`,
        [id]
      );
      await db.query(
        `UPDATE inventario SET estado = 'disponible', updated_at = NOW() WHERE id = ? AND estado = 'en_prestamo'`,
        [loan.inventario_id]
      );
      await db.query(
        'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
        [loan.inventario_id, `Devolución de ${loan.empleado_nombre} (${id})`]
      );
      await logAudit(req.body?.adminUser || null,
        'Registró devolución de préstamo', 'prestamo', id,
        `${id}: ${loan.inventario_id} devuelto por ${loan.empleado_nombre}`);
    }

    if (req.body.notas !== undefined)
      await db.query('UPDATE prestamos SET notas = ? WHERE id = ?', [req.body.notas, id]);

    res.json(await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar préstamo' });
  }
});

// ── API: Auth / Login ─────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });

    const user = await db.queryOne(
      `SELECT u.*, r.nombre AS rol, r.nivel AS rol_nivel
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.username = ? AND u.activo = 1`,
      [username]
    );

    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const ok = await db.bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    await db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [user.id]);

    res.json({
      ok: true,
      nombre:    `${user.nombre} ${user.apellido || ''}`.trim(),
      rol:       user.rol,
      rol_nivel: user.rol_nivel
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ── API: Departamentos ────────────────────────────────────────────────────────
app.get('/api/departamentos', async (req, res) => {
  try {
    const deptos = await db.query(
      'SELECT id, nombre FROM departamentos WHERE activo = 1 ORDER BY nombre'
    );
    res.json(deptos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar departamentos' });
  }
});

// ── API: Auth / Registro ──────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, nombre, apellido, telefono, departamento, mensaje } = req.body;

    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const existeUser = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (existeUser) return res.status(409).json({ error: 'El nombre de usuario ya existe.' });

    const existeSol = await db.queryOne(
      "SELECT id FROM solicitudes_registro WHERE username = ? AND estado = 'pendiente'",
      [username]
    );
    if (existeSol) return res.status(409).json({ error: 'Ya tienes una solicitud pendiente con ese usuario.' });

    const hash    = await db.bcrypt.hash(password, db.ROUNDS);

    await db.query(
      `INSERT INTO solicitudes_registro
         (nombre, apellido, email, username, password_hash, telefono,
          departamento_nombre, mensaje)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), apellido?.trim() || null, email?.trim() || null, username.trim(),
       hash, telefono?.trim() || null, departamento?.trim() || null,
       mensaje?.trim() || null]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

// ── API: Admins / Técnicos ────────────────────────────────────────────────────
app.get('/api/admins', async (req, res) => {
  try {
    const users = await db.query(
      `SELECT u.username,
              LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) AS nombre,
              r.nombre AS rol, r.nivel
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.nivel >= 2 AND u.activo = 1
       ORDER BY r.nivel DESC, u.nombre`
    );
    res.json(users.map(u => ({
      username: u.username,
      nombre:   u.nombre.trim(),
      rol:      u.rol,
      nivel:    u.nivel
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const { username, password, nombre, requestedBy } = req.body;

    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede crear usuarios' });
    if (!username || !password || !nombre)
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });

    const exists = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

    const hash = await db.bcrypt.hash(password, db.ROUNDS);
    await db.query(
      `INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo,
                             registro_aprobado, registro_aprobado_por, registro_aprobado_en)
       SELECT ?, ?, ?, (SELECT id FROM roles WHERE nombre = 'tecnico'), 1, 1, id, GETDATE()
       FROM usuarios WHERE username = ?`,
      [username.trim(), hash, nombre.trim(), requestedBy]
    );

    await logAudit(requestedBy, 'Creó usuario técnico', 'usuario', null, `@${username.trim()} — ${nombre.trim()}`);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.delete('/api/admins/:username', async (req, res) => {
  try {
    if (!await db.isAdmin(req.body?.requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede eliminar usuarios' });

    const admins = await db.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.nivel >= 2 AND u.activo = 1`
    );
    if (admins.length <= 1)
      return res.status(400).json({ error: 'No se puede eliminar el único administrador' });

    await db.query('UPDATE usuarios SET activo = FALSE WHERE username = ?', [req.params.username]);
    await logAudit(req.body?.requestedBy, 'Eliminó usuario técnico', 'usuario', null, `@${req.params.username}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ── API: Mobile upload ────────────────────────────────────────────────────────
app.post('/api/mobile-upload/session', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  mobileSessions.set(token, { status: 'pending', file: null, filePath: null, expiresAt: Date.now() + SESSION_TTL });
  res.json({ token });
});

app.get('/api/mobile-upload/qr/:token', async (req, res) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Sesión expirada' });

  const ip  = getLocalIP();
  const url = `http://${ip}:${PORT}/mobile-upload.html?session=${req.params.token}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.set('Content-Type', 'image/png').send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QR' });
  }
});

app.post('/api/mobile-upload/:token', mobileUpload.single('file'), (req, res) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(410).json({ error: 'Sesión expirada' });
  }
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  if (s.filePath && fs.existsSync(s.filePath)) fs.unlink(s.filePath, () => {});

  s.status   = 'ready';
  s.filePath = req.file.path;
  s.file     = { name: req.file.originalname, size: req.file.size, path: `/uploads/${req.file.filename}` };
  res.json({ ok: true });
});

app.get('/api/mobile-upload/status/:token', (req, res) => {
  const s = mobileSessions.get(req.params.token);
  if (!s || s.expiresAt < Date.now()) return res.status(410).json({ error: 'Expirada' });
  res.json({ status: s.status, file: s.file });
});

app.post('/api/tickets/:id/attachments/from-mobile', async (req, res) => {
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

// ── API: Usuarios ─────────────────────────────────────────────────────────────
app.get('/api/usuarios', async (req, res) => {
  try {
    const users = await db.query(
      `SELECT u.id, u.username, u.email, u.nombre, u.apellido, u.telefono,
              d.nombre AS departamento,
              r.nombre AS rol, r.nivel,
              u.activo, u.ultimo_login, u.created_at
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN departamentos d ON d.id = u.departamento_id
       ORDER BY r.nivel DESC, u.nombre`
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const { requestedBy } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede eliminar usuarios' });

    const self = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [requestedBy]);
    if (self && String(self.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });

    const target = await db.queryOne('SELECT id, username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Limpiar referencias FK antes de eliminar
    await db.query('UPDATE tickets      SET asignado_id    = NULL WHERE asignado_id        = ?', [req.params.id]);
    await db.query('UPDATE dispositivos SET tecnico_id     = NULL WHERE tecnico_id          = ?', [req.params.id]);
    await db.query('UPDATE inventario   SET responsable_id = NULL WHERE responsable_id      = ?', [req.params.id]);
    await db.query('UPDATE prestamos    SET empleado_id    = NULL WHERE empleado_id         = ?', [req.params.id]);
    await db.query('UPDATE prestamos    SET autorizado_por_id = NULL WHERE autorizado_por_id = ?', [req.params.id]);
    await db.query('UPDATE historial_inventario SET usuario_id = NULL WHERE usuario_id      = ?', [req.params.id]);
    // Marcar solicitudes del usuario como eliminadas y liberar la referencia de revisor
    await db.query(
      `UPDATE solicitudes_registro SET estado = 'eliminado', revisado_por = NULL
       WHERE username = ? OR revisado_por = ?`,
      [target.username, req.params.id]
    );

    await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    await logAudit(requestedBy, 'Eliminó usuario', 'usuario', req.params.id,
      `@${target.username}${target.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete usuario:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar usuario' });
  }
});

app.patch('/api/usuarios/:id/password', async (req, res) => {
  try {
    const { requestedBy, newPassword } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede cambiar contraseñas' });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash = await db.bcrypt.hash(newPassword, db.ROUNDS);
    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.params.id]);
    await logAudit(requestedBy, 'Cambió contraseña', 'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('change password:', err);
    res.status(500).json({ error: err.message || 'Error al cambiar contraseña' });
  }
});

app.patch('/api/usuarios/:id/activo', async (req, res) => {
  try {
    const { requestedBy, activo } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede modificar usuarios' });

    const self = await db.queryOne('SELECT id FROM usuarios WHERE username = ?', [requestedBy]);
    if (self && String(self.id) === String(req.params.id))
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });

    const target = await db.queryOne('SELECT username, nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    await db.query(
      'UPDATE usuarios SET activo = ?, updated_at = NOW() WHERE id = ?',
      [activo ? 1 : 0, req.params.id]
    );
    await logAudit(requestedBy,
      activo ? 'Activó usuario' : 'Desactivó usuario',
      'usuario', req.params.id,
      `@${target?.username || req.params.id}${target?.nombre ? ' — ' + [target.nombre, target.apellido].filter(Boolean).join(' ') : ''}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ── API: Solicitudes de registro ──────────────────────────────────────────────
app.get('/api/solicitudes', async (req, res) => {
  try {
    const sols = await db.query(
      `SELECT sr.id, sr.nombre, sr.apellido, sr.email, sr.username,
              sr.telefono, sr.mensaje, sr.estado,
              sr.motivo_rechazo,
              sr.created_at, sr.revisado_en,
              COALESCE(sr.departamento_nombre, d.nombre) AS departamento,
              LTRIM(RTRIM(CONCAT(u.nombre,' ',ISNULL(u.apellido,'')))) AS revisado_por_nombre
       FROM solicitudes_registro sr
       LEFT JOIN departamentos d ON d.id = sr.departamento_id
       LEFT JOIN usuarios u ON u.id = sr.revisado_por
       WHERE sr.estado <> 'eliminado'
       ORDER BY sr.created_at DESC`
    );
    res.json(sols);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar solicitudes' });
  }
});

app.post('/api/solicitudes/:id/aprobar', async (req, res) => {
  try {
    const { requestedBy } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede aprobar solicitudes' });

    const sol = await db.queryOne(
      'SELECT * FROM solicitudes_registro WHERE id = ?', [req.params.id]
    );
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (sol.estado !== 'pendiente')
      return res.status(409).json({ error: 'La solicitud ya fue procesada' });

    // Ignorar usuarios inactivos (eliminados con soft-delete) en los checks de unicidad
    const existe = await db.queryOne('SELECT id FROM usuarios WHERE username = ? AND activo = 1', [sol.username]);
    if (existe) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

    if (sol.email) {
      const existeEmail = await db.queryOne('SELECT id FROM usuarios WHERE email = ? AND activo = 1', [sol.email]);
      if (existeEmail) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    }

    // Resolver departamento: primero por ID guardado, luego por nombre libre
    let deptId = sol.departamento_id || null;
    if (!deptId && sol.departamento_nombre) {
      const dept = await db.queryOne(
        'SELECT id FROM departamentos WHERE LOWER(nombre) = LOWER(?)', [sol.departamento_nombre.trim()]
      );
      if (dept) deptId = dept.id;
    }

    await db.query(
      `INSERT INTO usuarios
         (username, email, password_hash, nombre, apellido, telefono, departamento_id,
          rol_id, activo, registro_aprobado)
       VALUES (?, ?, ?, ?, ?, ?, ?,
               (SELECT id FROM roles WHERE nombre = 'empleado'),
               1, 1)`,
      [sol.username, sol.email, sol.password_hash, sol.nombre, sol.apellido,
       sol.telefono, deptId]
    );

    await db.query(
      `UPDATE solicitudes_registro
       SET estado = 'aprobado',
           revisado_por = (SELECT id FROM usuarios WHERE username = ?),
           revisado_en  = NOW()
       WHERE id = ?`,
      [requestedBy, req.params.id]
    );
    await logAudit(requestedBy, 'Aprobó solicitud de acceso', 'solicitud', req.params.id,
      `@${sol.username} — ${sol.nombre} ${sol.apellido || ''}`.trim());

    res.json({ ok: true });
  } catch (err) {
    console.error('aprobar solicitud:', err);
    res.status(500).json({ error: err.message || 'Error al aprobar la solicitud' });
  }
});

app.post('/api/solicitudes/:id/rechazar', async (req, res) => {
  try {
    const { requestedBy, motivo } = req.body;
    if (!await db.isAdmin(requestedBy))
      return res.status(403).json({ error: 'Solo un administrador puede rechazar solicitudes' });

    const sol = await db.queryOne(
      'SELECT id, estado FROM solicitudes_registro WHERE id = ?', [req.params.id]
    );
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (sol.estado !== 'pendiente')
      return res.status(409).json({ error: 'La solicitud ya fue procesada' });

    const solInfo = await db.queryOne('SELECT username, nombre, apellido FROM solicitudes_registro WHERE id = ?', [req.params.id]);
    await db.query(
      `UPDATE solicitudes_registro
       SET estado = 'rechazado',
           motivo_rechazo = ?,
           revisado_por   = (SELECT id FROM usuarios WHERE username = ?),
           revisado_en    = NOW()
       WHERE id = ?`,
      [motivo || null, requestedBy, req.params.id]
    );
    await logAudit(requestedBy, 'Rechazó solicitud de acceso', 'solicitud', req.params.id,
      `@${solInfo?.username || req.params.id}${motivo ? ' — ' + motivo : ''}`);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar la solicitud' });
  }
});

// ── API: Tickets por usuario ──────────────────────────────────────────────────
app.get('/api/usuarios/:id/tickets', async (req, res) => {
  try {
    const user = await db.queryOne('SELECT nombre, apellido FROM usuarios WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const nombre = `${user.nombre} ${user.apellido || ''}`.trim();
    const tickets = await db.query(
      `SELECT id, titulo, status, prioridad, categoria, created_at
       FROM tickets WHERE reporter_nombre = ? ORDER BY created_at DESC`,
      [nombre]
    );
    res.json({ nombre, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tickets del usuario' });
  }
});

// ── API: Auditoría ────────────────────────────────────────────────────────────
app.get('/api/auditoria', async (req, res) => {
  try {
    const { actor, entidad, desde, hasta } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    let where = [];
    const params = [];

    if (actor)   { where.push('actor = ?');          params.push(actor); }
    if (entidad) { where.push('entidad = ?');         params.push(entidad); }
    if (desde)   { where.push('fecha >= ?');          params.push(desde); }
    if (hasta)   { where.push("fecha < DATEADD(day,1,CAST(? AS DATE))"); params.push(hasta); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = await db.query(
      `SELECT TOP ${limit} id, fecha, actor, accion, entidad, entidad_id, detalle
       FROM auditoria ${whereClause}
       ORDER BY fecha DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar auditoría' });
  }
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
db.initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n========================================');
    console.log('   GCM TICKETS - SERVIDOR ACTIVO (SQL Server)');
    console.log('========================================');
    console.log('');
    console.log('  Acceso local (este equipo):');
    console.log(`    http://localhost:${PORT}/admin.html`);
    console.log(`    http://localhost:${PORT}/usuario.html`);
    if (localIP !== 'localhost') {
      console.log('');
      console.log('  Acceso desde otros equipos en la red:');
      console.log(`    http://${localIP}:${PORT}/admin.html   <- Soporte técnico`);
      console.log(`    http://${localIP}:${PORT}/usuario.html <- Empleados`);
    }
    console.log('');
    console.log('  Para detener el servidor: Ctrl + C');
    console.log('========================================\n');
  });
});
