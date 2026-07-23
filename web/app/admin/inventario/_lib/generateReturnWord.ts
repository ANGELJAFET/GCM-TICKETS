import type { InventoryItem, Loan } from '@/lib/types';

/** Etiqueta legible por condición física, usada en el comprobante impreso. */
const CONDICION_MAP: Record<string, string> = { nuevo: 'Nuevo', excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', danado: 'Dañado' };

/** Escapa caracteres especiales de HTML para interpolar texto de usuario de forma segura en la plantilla. */
function escapeHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Hermano de {@link generateLoanWord} — mismo truco HTML→Word y mismo
 * membrete, pero documenta el evento de devolución (fecha real, condición
 * al regresar, días de atraso si aplica, quién recibe en TI) en vez de la
 * entrega original. Antes de esto, el botón "Comprobante" de un préstamo ya
 * devuelto regeneraba el mismo comprobante de préstamo, sin dejar
 * constancia de la devolución.
 * @param loan Préstamo ya devuelto (usa `fechaDevolucionReal`, `condicionDevolucion`, `notaDevolucion`).
 * @param item Datos del equipo devuelto (puede venir parcial/`undefined`).
 * @param adminNombre Nombre de quien recibe el equipo en TI (aparece en la firma "Recibí Conforme").
 */
export function generateReturnWord(loan: Loan, item: Partial<InventoryItem> | undefined, adminNombre: string) {
  const it = item || {};
  const now = loan.fechaDevolucionReal ? new Date(loan.fechaDevolucionReal) : new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio = now.getFullYear();

  const condicion = CONDICION_MAP[loan.condicionDevolucion || ''] || loan.condicionDevolucion || '';
  const tipoDesc = [it.tipo, it.marca, it.modelo].filter(Boolean).join(' ');
  const logoUrl = window.location.origin + '/assets/gcm.jpg';

  // Mismo criterio que "vencido" en PrestamosView.tsx (new Date() sobre la
  // fecha ya formateada por fmtDate en el backend) — se reusa aquí para no
  // duplicar formato ni agregar campos *Ts nuevos solo para esta cuenta.
  let diasAtraso = 0;
  if (loan.fechaDevolucionEstimada && loan.fechaDevolucionReal) {
    const est = new Date(loan.fechaDevolucionEstimada);
    const real = new Date(loan.fechaDevolucionReal);
    diasAtraso = Math.max(0, Math.round((real.getTime() - est.getTime()) / 86400000));
  }

  const S = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;font-weight:bold;';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<title>Devolucion ${loan.id}</title>
<style>
html{color-scheme:light only;}
body{${S}margin:1.5cm 2cm;line-height:1.3;background:#ffffff !important;}
table{${S}border-collapse:collapse;background:#ffffff !important;}
td{background:#ffffff !important;}
p{margin:0 0 7px;padding:0;color:#000 !important;}
</style>
</head>
<body style="background:#ffffff !important;color:#000 !important">

<table border="0" width="100%" cellspacing="0" cellpadding="0" style="height:70px;">
<tr style="height:70px;">
<td style="width:75px;padding:0;" valign="middle">
  <img src="${logoUrl}" width="65" height="65"
       style="width:65px;height:65px;mso-width-source:userset;mso-height-source:userset;display:block;">
</td>
<td align="center" valign="middle" style="${S}font-size:14pt;font-weight:bold;text-decoration:underline;">
GRUPO CAMARONERO MILCIEN S.A. de C.V.
</td>
</tr>
</table>

<hr style="border:0;border-top:2px solid #000;margin:6px 0 10px;">

<p><b>ASUNTO:</b>&nbsp;&nbsp;DEVOLUCION DE EQUIPO TECNOLOGICO.&nbsp;&nbsp;&nbsp;&nbsp;No.&nbsp;${loan.id}</p>

<p><b>FECHA:</b>&nbsp;&nbsp;__${dia}__de__${mes}__${anio}__.</p>

<p style="text-align:justify;line-height:1.5;margin-bottom:8px;">
POR ESTE MEDIO HACEMOS CONSTAR, QUE SE RECIBIO EN CALIDAD DE DEVOLUCION
LA CANTIDAD DE: __${loan.cantidad || 1}__ ${escapeHtml(tipoDesc.toUpperCase())} CON LAS SIGUIENTES CARACTERISTICAS:
</p>

<table border="0" cellpadding="2" cellspacing="0" style="margin-left:18px;margin-bottom:10px;line-height:1.5;">
<tr><td style="${SB}">N&deg; DE INVENTARIO:</td><td style="${S}">&nbsp;${escapeHtml(loan.inventoryId)}</td></tr>
<tr><td style="${SB}">MARCA:</td><td style="${S}">&nbsp;${escapeHtml((it.marca || '').toUpperCase())}${it.modelo ? ' ' + escapeHtml(it.modelo.toUpperCase()) : ''}</td></tr>
${it.serie ? `<tr><td style="${SB}">S/N:</td><td style="${S}">&nbsp;${escapeHtml(it.serie.toUpperCase())}</td></tr>` : ''}
${it.color ? `<tr><td style="${SB}">COLOR:</td><td style="${S}">&nbsp;${escapeHtml(it.color.toUpperCase())}</td></tr>` : ''}
${condicion ? `<tr><td style="${SB}">CONDICION AL DEVOLVER:</td><td style="${S}">&nbsp;${escapeHtml(condicion.toUpperCase())}</td></tr>` : ''}
${it.ubicacion ? `<tr><td style="${SB}">UBICACION DE DESTINO:</td><td style="${S}">&nbsp;${escapeHtml(it.ubicacion.toUpperCase())}</td></tr>` : ''}
</table>

<table border="0" cellpadding="2" cellspacing="0" style="margin-left:18px;margin-bottom:10px;line-height:1.5;">
<tr><td style="${SB}">PRESTADO DESDE:</td><td style="${S}">&nbsp;${escapeHtml(loan.fechaPrestamo)}</td></tr>
${loan.fechaDevolucionEstimada ? `<tr><td style="${SB}">DEVOLUCION ESTIMADA:</td><td style="${S}">&nbsp;${escapeHtml(loan.fechaDevolucionEstimada)}</td></tr>` : ''}
<tr><td style="${SB}">DEVOLUCION REAL:</td><td style="${S}">&nbsp;${escapeHtml(loan.fechaDevolucionReal || '')}${diasAtraso > 0 ? ` <span style="color:#b91c1c;font-weight:bold;">(${diasAtraso} d&iacute;a${diasAtraso === 1 ? '' : 's'} de atraso)</span>` : ''}</td></tr>
${loan.autorizadoPor ? `<tr><td style="${SB}">PRESTAMO AUTORIZADO POR:</td><td style="${S}">&nbsp;${escapeHtml(loan.autorizadoPor.toUpperCase())}</td></tr>` : ''}
</table>

${loan.notas ? `<p><b>NOTA DEL PRESTAMO:</b>&nbsp;${escapeHtml(String(loan.notas).toUpperCase())}</p>` : ''}
${loan.notaDevolucion ? `<p><b>NOTA DE DEVOLUCION:</b>&nbsp;${escapeHtml(String(loan.notaDevolucion).toUpperCase())}</p>` : ''}

<table border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
<tr>
<td width="20%">&nbsp;</td>
<td width="60%" align="center" style="${S}font-weight:bold;border-top:1px solid #000;padding-top:6px;">
${escapeHtml(String(loan.empleado || '').toUpperCase())}${loan.departamento ? `<br><span style="${S}font-weight:normal;">${escapeHtml(String(loan.departamento).toUpperCase())}</span>` : ''}
</td>
<td width="20%">&nbsp;</td>
</tr>
</table>

<table border="0" width="100%" cellspacing="0" cellpadding="3" style="margin-top:28px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entrega (empleado):</b><br>${escapeHtml(String(loan.empleado || '').toUpperCase())}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme (TI):</b><br>${escapeHtml(String(adminNombre || 'Depto. Sistemas / TI').toUpperCase())}
</td>
</tr>
</table>

</body>
</html>`;

  const blob = new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devolucion_${loan.id}_${loan.inventoryId}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
