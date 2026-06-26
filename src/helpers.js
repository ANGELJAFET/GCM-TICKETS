const os = require('os');
const db = require('./db');

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

async function logAudit(actor, accion, entidad, entidadId, detalle) {
  try {
    await db.exec('sp_LogAudit', {
      actor:      actor    || null,
      accion,
      entidad:    entidad  || null,
      entidad_id: entidadId ? String(entidadId) : null,
      detalle:    detalle  || null
    });
  } catch (err) {
    console.error('logAudit:', err.message);
  }
}

module.exports = { fmtDate, fmtTime, fmtTs, getLocalIP, logAudit };
