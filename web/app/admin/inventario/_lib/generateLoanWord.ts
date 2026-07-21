import type { InventoryItem, Loan } from '@/lib/types';

const CONDICION_MAP: Record<string, string> = { nuevo: 'Nuevo', excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', danado: 'Dañado' };

function escapeHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// Genera un comprobante .doc (truco HTML→Word, sin librería) idéntico al de
// admin.js — se descarga directo desde el navegador vía Blob.
export function generateLoanWord(loan: Loan, item: Partial<InventoryItem> | undefined, adminNombre: string) {
  const it = item || {};
  const now = new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio = now.getFullYear();

  const condicion = CONDICION_MAP[it.condicion || ''] || it.condicion || '';
  const tipoDesc = [it.tipo, it.marca, it.modelo].filter(Boolean).join(' ');
  const logoUrl = window.location.origin + '/assets/gcm.jpg';

  const S = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;font-weight:bold;';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<title>Prestamo ${loan.id}</title>
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

<p><b>ASUNTO:</b>&nbsp;&nbsp;PRESTAMO DE EQUIPO TECNOLOGICO.&nbsp;&nbsp;&nbsp;&nbsp;No.&nbsp;${loan.id}</p>

<p><b>FECHA:</b>&nbsp;&nbsp;__${dia}__de__${mes}__${anio}__.</p>

<p style="text-align:justify;line-height:1.5;margin-bottom:8px;">
POR ESTE MEDIO HACEMOS CONSTAR, QUE SE ENTREGO EN CALIDAD DE PRESTAMO
LA CANTIDAD DE: __${loan.cantidad || 1}__ ${escapeHtml(tipoDesc.toUpperCase())} CON LAS SIGUIENTES CARACTERISTICAS:
</p>

<table border="0" cellpadding="2" cellspacing="0" style="margin-left:18px;margin-bottom:10px;line-height:1.5;">
<tr><td style="${SB}">MARCA:</td><td style="${S}">&nbsp;${escapeHtml((it.marca || '').toUpperCase())}${it.modelo ? ' ' + escapeHtml(it.modelo.toUpperCase()) : ''}</td></tr>
${it.serie ? `<tr><td style="${SB}">S/N:</td><td style="${S}">&nbsp;${escapeHtml(it.serie.toUpperCase())}</td></tr>` : ''}
${it.color ? `<tr><td style="${SB}">COLOR:</td><td style="${S}">&nbsp;${escapeHtml(it.color.toUpperCase())}</td></tr>` : ''}
${condicion ? `<tr><td style="${SB}">CONDICION:</td><td style="${S}">&nbsp;${escapeHtml(condicion.toUpperCase())}</td></tr>` : ''}
${it.ubicacion ? `<tr><td style="${SB}">UBICACION HABITUAL:</td><td style="${S}">&nbsp;${escapeHtml(it.ubicacion.toUpperCase())}</td></tr>` : ''}
</table>

<p><b>FECHA DE DEVOLUCION ESTIMADA:</b>&nbsp;${loan.fechaDevolucionEstimada ? escapeHtml(loan.fechaDevolucionEstimada) : '__________________________'}</p>

${loan.notas ? `<p><b>NOTA:</b>&nbsp;${escapeHtml(String(loan.notas).toUpperCase())}</p>` : ''}

<p style="text-align:justify;line-height:1.4;margin-top:10px;margin-bottom:8px;">
<b>RESPONSABILIDAD:</b>&nbsp;EL RECEPTOR SE COMPROMETE A RESGUARDAR Y UTILIZAR EL EQUIPO UNICAMENTE PARA FINES LABORALES, Y A DEVOLVERLO EN LAS MISMAS CONDICIONES EN QUE LO RECIBIO. EN CASO DE DAÑO, PERDIDA O ROBO OCASIONADO POR NEGLIGENCIA O MAL USO, EL RECEPTOR SE HACE RESPONSABLE DE SU REPARACION O REPOSICION.
</p>

<table border="0" width="100%" cellspacing="0" cellpadding="3" style="margin-top:34px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entregado por:</b><br>${escapeHtml(String(adminNombre || 'Depto. Sistemas / TI').toUpperCase())}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme:</b><br>${escapeHtml(String(loan.empleado || '').toUpperCase())}
</td>
</tr>
</table>

</body>
</html>`;

  const blob = new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prestamo_${loan.id}_${loan.inventoryId}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
