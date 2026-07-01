require('dotenv').config();
const nodemailer = require('nodemailer');

const enabled =
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

const transporter = enabled
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const FROM    = process.env.SMTP_FROM || `"GCM Tickets" <${process.env.SMTP_USER}>`;
const APP_URL = process.env.APP_URL   || 'http://10.0.1.108:3000';
const CC      = process.env.SMTP_CC   || null;

async function send({ to, subject, html }) {
  if (!transporter) {
    console.warn('[mailer] SMTP no configurado, email omitido:', subject);
    return;
  }
  try {
    const msg = { from: FROM, to, subject, html };
    if (CC && CC !== to) msg.cc = CC;
    const info = await transporter.sendMail(msg);
    console.log(`[mailer] Enviado a ${to}${CC && CC !== to ? ` (cc: ${CC})` : ''} — ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[mailer] Error al enviar a ${to}:`, err.message);
  }
}

// ── Plantillas ────────────────────────────────────────────────────

function baseHtml(contenido) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1a3c6e;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;letter-spacing:.5px;">GCM TICKETS</h1>
            <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Sistema de Soporte Técnico</p>
          </td>
        </tr>
        <tr><td style="padding:32px;">${contenido}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
              Este correo fue generado automáticamente por GCM Tickets.<br>
              <a href="${APP_URL}" style="color:#2563eb;">Ir al sistema</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailNuevoRegistro({ nombre, username, departamento }) {
  return {
    subject: '📋 Nueva solicitud de registro — GCM Tickets',
    html: baseHtml(`
      <h2 style="color:#1a3c6e;margin-top:0;">Nueva solicitud de registro</h2>
      <p style="color:#475569;">Un nuevo usuario ha solicitado acceso al sistema y requiere aprobación.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;width:140px;"><b>Nombre</b></td><td style="color:#1e293b;font-size:13px;">${nombre}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;"><b>Usuario</b></td><td style="color:#1e293b;font-size:13px;">${username}</td></tr>
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;"><b>Departamento</b></td><td style="color:#1e293b;font-size:13px;">${departamento || 'No especificado'}</td></tr>
      </table>
      <a href="${APP_URL}/admin.html" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">Revisar en el panel admin</a>
    `),
  };
}

function emailTicketNuevo({ folio, titulo, prioridad, nombre, departamento }) {
  const colorPrioridad = { alta: '#dc2626', media: '#d97706', baja: '#16a34a' };
  const color = colorPrioridad[prioridad?.toLowerCase()] || '#2563eb';
  return {
    subject: `🎫 Ticket #${folio} recibido — ${titulo}`,
    html: baseHtml(`
      <h2 style="color:#1a3c6e;margin-top:0;">Ticket recibido</h2>
      <p style="color:#475569;">Hemos recibido tu solicitud de soporte técnico. Te contactaremos pronto.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;width:140px;"><b>Folio</b></td><td style="color:#1e293b;font-size:13px;font-weight:bold;">#${folio}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;"><b>Asunto</b></td><td style="color:#1e293b;font-size:13px;">${titulo}</td></tr>
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;"><b>Solicitante</b></td><td style="color:#1e293b;font-size:13px;">${nombre}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;"><b>Departamento</b></td><td style="color:#1e293b;font-size:13px;">${departamento || '—'}</td></tr>
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;"><b>Prioridad</b></td><td><span style="background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${prioridad || 'Normal'}</span></td></tr>
      </table>
      <a href="${APP_URL}/usuario.html" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">Ver mis tickets</a>
    `),
  };
}

function emailCambioEstado({ folio, titulo, estadoAnterior, estadoNuevo, nombre, comentario }) {
  const colorEstado = { 'en proceso': '#d97706', resuelto: '#16a34a', cerrado: '#64748b', abierto: '#2563eb' };
  const color = colorEstado[estadoNuevo?.toLowerCase()] || '#2563eb';
  return {
    subject: `🔄 Ticket #${folio} actualizado — ${estadoNuevo}`,
    html: baseHtml(`
      <h2 style="color:#1a3c6e;margin-top:0;">Tu ticket fue actualizado</h2>
      <p style="color:#475569;">Hola <b>${nombre}</b>, el estado de tu solicitud ha cambiado.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;width:140px;"><b>Folio</b></td><td style="color:#1e293b;font-size:13px;font-weight:bold;">#${folio}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;"><b>Asunto</b></td><td style="color:#1e293b;font-size:13px;">${titulo}</td></tr>
        <tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;"><b>Estado anterior</b></td><td style="color:#64748b;font-size:13px;">${estadoAnterior || '—'}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;"><b>Estado actual</b></td><td><span style="background:${color};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${estadoNuevo}</span></td></tr>
        ${comentario ? `<tr style="background:#f1f5f9;"><td style="color:#64748b;font-size:13px;"><b>Comentario</b></td><td style="color:#1e293b;font-size:13px;">${comentario}</td></tr>` : ''}
      </table>
      <a href="${APP_URL}/usuario.html" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">Ver mis tickets</a>
    `),
  };
}

module.exports = {
  send,
  emailNuevoRegistro,
  emailTicketNuevo,
  emailCambioEstado,
};
