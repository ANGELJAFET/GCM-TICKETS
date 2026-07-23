/**
 * Utilidades compartidas del backend: formato de fechas en español (Honduras),
 * detección de la IP LAN de esta máquina, resolución de la URL pública del
 * frontend y registro de auditoría.
 */
import os from 'os';
import db from './db';
import { WEB_PORT } from './config';

/**
 * Formatea una fecha como texto corto en español (`es-HN`), ej. `"23 jul. 2026"`.
 * @param d Fecha a formatear (`Date`, ISO string o timestamp numérico).
 */
function fmtDate(d: Date | string | number): string {
  return new Date(d).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Formatea una fecha con hora en español (`es-HN`), ej. `"23 jul. 2026, 09:30"`.
 * @param d Fecha a formatear (`Date`, ISO string o timestamp numérico).
 */
function fmtTs(d: Date | string | number): string {
  return new Date(d).toLocaleString('es-HN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Detecta la IP IPv4 de la red local (LAN) de esta máquina, evitando
 * interfaces virtuales (VMware, Hyper-V, loopback, etc.). Se usa para armar
 * URLs accesibles desde otros dispositivos de la red (ej. el QR de subida
 * desde celular). Prioriza direcciones `10.x.x.x` por ser el rango típico
 * de la red interna de la empresa.
 * @returns La IP LAN detectada, o `'localhost'` si no se encontró ninguna interfaz externa.
 */
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

/**
 * Registra una entrada en la bitácora de auditoría (`sp_LogAudit`). Pensado
 * para llamarse tras cualquier acción administrativa relevante (crear/editar
 * usuarios, tickets, préstamos, etc.). No relanza errores: un fallo al
 * auditar no debe interrumpir la operación que se está auditando, solo se
 * registra en consola.
 * @param actor Username o identificador de quien ejecuta la acción (`null` si no aplica).
 * @param accion Descripción corta de la acción realizada (ej. `'crear_usuario'`).
 * @param entidad Tipo de entidad afectada (ej. `'ticket'`, `'usuario'`), o `null`.
 * @param entidadId ID de la entidad afectada, o `null`.
 * @param detalle Texto libre con detalle adicional de la acción, o `null`.
 */
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
