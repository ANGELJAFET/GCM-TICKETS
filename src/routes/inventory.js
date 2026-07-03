const express      = require('express');
const router       = express.Router();
const db           = require('../db');
const { fmtDate, logAudit }  = require('../helpers');
const { loadTicket }         = require('../ticketLoader');
const { requireRole }        = require('../middleware/auth');

// GET /api/devices
router.get('/devices', ...requireRole(2), async (req, res) => {
  try {
    const devices = await db.exec('sp_GetDevices');
    res.json(devices.map(d => ({
      id: d.id, tipo: d.tipo, marca: d.marca, modelo: d.modelo,
      serie: d.numero_serie, estadoFisico: d.estado_fisico,
      fallaCliente: d.falla_cliente, accesorios: d.accesorios || [],
      clienteNombre: d.cliente_nombre, clienteTel: d.cliente_tel,
      tecnico: (d.tecnico_display || '').trim() || 'Sin asignar',
      fecha: fmtDate(d.created_at), fechaTs: new Date(d.created_at).getTime()
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar dispositivos' });
  }
});

// POST /api/devices
router.post('/devices', ...requireRole(2), async (req, res) => {
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

    await db.exec('sp_CrearDispositivoConTicket', {
      dev_id: devId, ticket_id: ticketId, tipo, marca,
      modelo: modelo || '', numero_serie: serie || '',
      estado_fisico: estadoFisico || 'bueno', falla_cliente: fallaCliente,
      accesorios: JSON.stringify(accArr), cliente_nombre: clienteNombre,
      cliente_tel: clienteTel || '', tecnico_id: tecnicoId, tecnico_display: tecnicoDisplay,
      titulo: `Recepción: ${marca} ${modelo || tipo}`.trim(), descripcion: desc,
      reporter_nombre: `${clienteNombre}${telText}`
    });

    res.status(201).json({
      device: (await db.queryOne('SELECT * FROM dispositivos WHERE id = ?', [devId])),
      ticket: await loadTicket(ticketId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
});

// GET /api/inventory
router.get('/inventory', ...requireRole(2), async (req, res) => {
  try {
    const items = await db.exec('sp_GetInventory');
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

// POST /api/inventory
router.post('/inventory', ...requireRole(2), async (req, res) => {
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
    await logAudit(req.user.nombre, 'Agregó equipo al inventario', 'inventario', id,
      `${id}: ${tipo} ${marca}${modelo ? ' ' + modelo : ''}`);

    res.status(201).json({ id, tipo, marca, modelo, serie, color, condicion,
      estado: 'disponible', ubicacion, responsable, notas, garantia, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar equipo' });
  }
});

// PATCH /api/inventory/:id
router.patch('/inventory/:id', ...requireRole(2), async (req, res) => {
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
      await logAudit(req.user.nombre, 'Editó equipo del inventario', 'inventario', id,
        `${id}: campos modificados — ${sets.map(s => s.split(' =')[0]).join(', ')}`);
    }

    const updated = await db.queryOne('SELECT * FROM inventario WHERE id = ?', [id]);
    res.json({ ...updated, garantia: updated.garantia ? JSON.parse(updated.garantia) : null, historial: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar equipo' });
  }
});

// DELETE /api/inventory/:id
router.delete('/inventory/:id', ...requireRole(2), async (req, res) => {
  try {
    const id = req.params.id;

    const activeLoan = await db.queryOne(
      "SELECT id FROM prestamos WHERE inventario_id = ? AND estado = 'activo'", [id]
    );
    if (activeLoan)
      return res.status(409).json({ error: 'No se puede eliminar un equipo con préstamo activo. Registra la devolución primero.' });

    const inv = await db.queryOne('SELECT tipo, marca, modelo FROM inventario WHERE id = ?', [id]);

    await db.query('DELETE FROM historial_inventario WHERE inventario_id = ?', [id]);
    await db.query('DELETE FROM prestamos WHERE inventario_id = ?', [id]);
    await db.query('DELETE FROM inventario WHERE id = ?', [id]);

    await logAudit(req.user.nombre, 'Eliminó equipo del inventario', 'inventario', id,
      inv ? `${id}: ${inv.tipo} ${inv.marca} ${inv.modelo || ''}`.trim() : id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

// GET /api/loans
router.get('/loans', ...requireRole(2), async (req, res) => {
  try {
    const loans = await db.exec('sp_GetLoans');
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

// POST /api/loans
router.post('/loans', ...requireRole(2), async (req, res) => {
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
    await logAudit(req.user.nombre,
      'Registró préstamo', 'prestamo', id,
      `${id}: ${inventoryId} → ${empleado}${departamento ? ' (' + departamento + ')' : ''}`);
    res.status(201).json({ loan, item: inv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar préstamo' });
  }
});

// PATCH /api/loans/:id
router.patch('/loans/:id', ...requireRole(2), async (req, res) => {
  try {
    const id   = req.params.id;
    const loan = await db.queryOne('SELECT * FROM prestamos WHERE id = ?', [id]);
    if (!loan) return res.status(404).json({ error: 'Préstamo no encontrado' });

    if (req.body.estado === 'devuelto' && loan.estado !== 'devuelto') {
      await db.query(
        `UPDATE prestamos SET estado = 'devuelto', fecha_devolucion_real = NOW() WHERE id = ?`, [id]
      );
      await db.query(
        `UPDATE inventario SET estado = 'disponible', updated_at = NOW() WHERE id = ? AND estado = 'en_prestamo'`,
        [loan.inventario_id]
      );
      await db.query(
        'INSERT INTO historial_inventario (inventario_id, accion) VALUES (?, ?)',
        [loan.inventario_id, `Devolución de ${loan.empleado_nombre} (${id})`]
      );
      await logAudit(req.user.nombre,
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

// GET /api/auditoria
router.get('/auditoria', ...requireRole(2), async (req, res) => {
  try {
    const { actor, entidad, desde, hasta } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    const rows = await db.exec('sp_GetAuditoria', {
      actor:   actor   || null,
      entidad: entidad || null,
      desde:   desde   || null,
      hasta:   hasta   || null,
      limit
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar auditoría' });
  }
});

module.exports = router;
