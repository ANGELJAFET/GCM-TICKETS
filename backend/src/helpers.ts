import os from 'os';
import db from './db';
import { WEB_PORT } from './config';

function fmtDate(d: Date | string | number): string {
  return new Date(d).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTs(d: Date | string | number): string {
  return new Date(d).toLocaleString('es-HN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function getLocalIP(): string {
  const nets = os.networkInterfaces();
  let fallback: string | null = null;
  for (const name of Object.keys(nets)) {
    if (/vmware|vmnet|virtual|hyper|vethernet|loopback/i.test(name)) continue;
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (net.address.startsWith('10.')) return net.address;
      if (!fallback) fallback = net.address;
    }
  }
  if (fallback) return fallback;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// URL pública del frontend (web/) — usada por el QR de subida desde celular
// y por los links de los correos de notificación. WEB_APP_URL es un override
// explícito (dominio/IP fija); si no está configurado, se arma con la IP LAN
// detectada de esta máquina + WEB_PORT, asumiendo que backend y frontend
// corren en el mismo equipo.
function getWebAppUrl(): string {
  if (process.env.WEB_APP_URL) return process.env.WEB_APP_URL.replace(/\/$/, '');
  return `http://${getLocalIP()}:${WEB_PORT}`;
}

async function logAudit(
  actor: string | null | undefined,
  accion: string,
  entidad: string | null | undefined,
  entidadId: string | number | null | undefined,
  detalle: string | null | undefined
): Promise<void> {
  try {
    await db.exec('sp_LogAudit', {
      actor:      actor    || null,
      accion,
      entidad:    entidad  || null,
      entidad_id: entidadId ? String(entidadId) : null,
      detalle:    detalle  || null
    });
  } catch (err: any) {
    console.error('logAudit:', err.message);
  }
}

export { fmtDate, fmtTs, getLocalIP, getWebAppUrl, logAudit };
