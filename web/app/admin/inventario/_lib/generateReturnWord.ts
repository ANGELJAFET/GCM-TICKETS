import type { InventoryItem, Loan } from '@/lib/types';

/** Etiqueta legible por condición física, usada en el comprobante impreso. */
const CONDICION_MAP: Record<string, string> = { nuevo: 'Nuevo', excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', danado: 'Dañado' };

/** Escapa caracteres especiales de HTML para interpolar texto de usuario de forma segura en la plantilla. */
function escapeHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Hermano de {@link generateLoanWord} — mismo membrete y formato, pero
 * documenta la devolución (fecha real, condición al regresar, días de atraso)
 * de uno o varios equipos entregados juntos (préstamo agrupado). Los datos
 * compartidos (empleado, fechas) se toman del primer préstamo.
 * @param loans Préstamos devueltos (uno, o todos los de un grupo).
 * @param itemsById Mapa `inventoryId -> equipo`.
 * @param adminNombre Nombre de quien recibe en TI (firma "Recibí Conforme").
 */
export function generateReturnWord(loans: Loan[], itemsById: Record<string, Partial<InventoryItem> | undefined>, adminNombre: string) {
  if (!loans.length) return;
  const base = loans[0];
  const now = base.fechaDevolucionReal ? new Date(base.fechaDevolucionReal) : new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio = now.getFullYear();

  const logoUrl = window.location.origin + '/assets/gcm.jpg';
  const folio = base.grupoId || base.id;

  // Mismo criterio que "vencido" en PrestamosView (base.fechaDevolucionEstimada
  // ya viene formateada por fmtDate en el backend) — días de atraso del grupo.
  let diasAtraso = 0;
  if (base.fechaDevolucionEstimada && base.fechaDevolucionReal) {
    const est = new Date(base.fechaDevolucionEstimada);
    const real = new Date(base.fechaDevolucionReal);
    diasAtraso = Math.max(0, Math.round((real.getTime() - est.getTime()) / 86400000));
  }

  const S = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;font-weight:bold;';

  const filas = loans.map((l, i) => {
    const it = itemsById[l.inventoryId] || {};
    const marcaModelo = [it.marca, it.modelo].filter(Boolean).map((x) => String(x).toUpperCase()).join(' ') || '—';
    const tipo = it.tipo ? String(it.tipo).toUpperCase() : '—';
    const serie = it.serie ? String(it.serie).toUpperCase() : '—';
    const cond = CONDICION_MAP[l.condicionDevolucion || ''] || l.condicionDevolucion || '';
    const bg = i % 2 ? '' : 'background:#f2f2f2;';
    return `<tr style="${bg}">
      <td style="${S}border:1px solid #000;padding:5px 7px;text-align:center;">${i + 1}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(l.inventoryId)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(tipo)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(marcaModelo)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(serie)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml((cond || '—').toUpperCase())}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;text-align:center;">${l.cantidad || 1}</td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<title>Devolucion ${folio}</title>
<style>
html{color-scheme:light only;}
@page WordSectionRet{size:21.59cm 27.94cm;margin:1.5cm 2cm 3.4cm 2cm;mso-footer-margin:1.0cm;mso-footer:rf1;}
div.WordSectionRet{page:WordSectionRet;}
body{${S}margin:0;line-height:1.5;background:#ffffff !important;}
table{${S}border-collapse:collapse;background:#ffffff !important;}
td{background:#ffffff !important;}
p{margin:0 0 9px;padding:0;color:#000 !important;}
</style>
</head>
<body style="background:#ffffff !important;color:#000 !important">
<div class="WordSectionRet">

<table border="0" width="100%" cellspacing="0" cellpadding="0" style="height:74px;">
<tr style="height:74px;">
<td style="width:75px;padding:0;" valign="middle">
  <img src="${logoUrl}" width="65" height="65"
       style="width:65px;height:65px;mso-width-source:userset;mso-height-source:userset;display:block;">
</td>
<td align="center" valign="middle" style="${S}font-size:15pt;font-weight:bold;text-decoration:underline;">
GRUPO CAMARONERO MILCIEN S.A. de C.V.
</td>
</tr>
</table>

<hr style="border:0;border-top:2px solid #000;margin:6px 0 10px;">

<p><b>ASUNTO:</b>&nbsp;&nbsp;DEVOLUCION DE EQUIPO TECNOLOGICO.&nbsp;&nbsp;&nbsp;&nbsp;No.&nbsp;${escapeHtml(folio)}</p>

<p><b>FECHA:</b>&nbsp;&nbsp;__${dia}__de__${mes}__${anio}__.</p>

<p style="text-align:justify;line-height:1.5;margin-bottom:8px;">
POR ESTE MEDIO HACEMOS CONSTAR, QUE SE RECIBIO EN CALIDAD DE DEVOLUCION EL/LOS SIGUIENTE(S) EQUIPO(S):
</p>

<table border="1" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:10px;">
<tr style="background:#d9d9d9;">
  <td style="${SB}border:1px solid #000;padding:5px 7px;text-align:center;">#</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">N&deg; INV.</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">TIPO</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">MARCA / MODELO</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">S/N</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">CONDICION</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;text-align:center;">CANT.</td>
</tr>
${filas}
</table>

<table border="0" cellpadding="2" cellspacing="0" style="margin-left:2px;margin-bottom:10px;line-height:1.5;">
<tr><td style="${SB}">PRESTADO DESDE:</td><td style="${S}">&nbsp;${escapeHtml(base.fechaPrestamo)}</td></tr>
${base.fechaDevolucionEstimada ? `<tr><td style="${SB}">DEVOLUCION ESTIMADA:</td><td style="${S}">&nbsp;${escapeHtml(base.fechaDevolucionEstimada)}</td></tr>` : ''}
<tr><td style="${SB}">DEVOLUCION REAL:</td><td style="${S}">&nbsp;${escapeHtml(base.fechaDevolucionReal || '')}${diasAtraso > 0 ? ` <span style="color:#b91c1c;font-weight:bold;">(${diasAtraso} d&iacute;a${diasAtraso === 1 ? '' : 's'} de atraso)</span>` : ''}</td></tr>
${base.autorizadoPor ? `<tr><td style="${SB}">PRESTAMO AUTORIZADO POR:</td><td style="${S}">&nbsp;${escapeHtml(base.autorizadoPor.toUpperCase())}</td></tr>` : ''}
</table>

${base.notas ? `<p><b>NOTA DEL PRESTAMO:</b>&nbsp;${escapeHtml(String(base.notas).toUpperCase())}</p>` : ''}
${base.notaDevolucion ? `<p><b>NOTA DE DEVOLUCION:</b>&nbsp;${escapeHtml(String(base.notaDevolucion).toUpperCase())}</p>` : ''}

<div style='mso-element:footer' id="rf1">
<table border="0" width="100%" cellspacing="0" cellpadding="3" style="${S}margin-top:18px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entrega (empleado):</b><br>${escapeHtml(String(base.empleado || '').toUpperCase())}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme (TI):</b><br>${escapeHtml(String(adminNombre || 'Depto. Sistemas / TI').toUpperCase())}
</td>
</tr>
</table>
</div>

</div>
</body>
</html>`;

  const blob = new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devolucion_${folio}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
