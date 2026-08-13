/**
 * Genera el comprobante de préstamo de equipo, imprimible/editable en Word:
 * un documento HTML descargado con extensión `.doc` (Word lo abre e
 * interpreta el HTML como si fuera su propio formato), sin depender de
 * ninguna librería de generación de `.docx`.
 *
 * Soporta uno o varios equipos en el mismo comprobante (préstamo agrupado):
 * los equipos se listan en una tabla y comparten empleado, fechas y firma.
 */
import type { InventoryItem, Loan } from '@/lib/types';
import { fileUrl } from '@/lib/api';

/** Etiqueta legible por condición física, usada en el comprobante impreso. */
const CONDICION_MAP: Record<string, string> = { nuevo: 'Nuevo', excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', danado: 'Dañado' };

/** Escapa caracteres especiales de HTML para interpolar texto de usuario de forma segura en la plantilla. */
function escapeHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Descarga una imagen de `/uploads` y la devuelve como data URI JPEG
 * redimensionado y comprimido, para incrustarla en el `.doc` sin depender del
 * servidor (el documento queda autocontenido y se ve offline).
 */
function photoToDataUrl(path: string, maxDim = 520, quality = 0.75): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = fileUrl(path);
  });
}

/**
 * Genera y descarga el comprobante de préstamo con uno o varios equipos.
 * @param loans Préstamos a documentar. Uno solo, o todos los de un mismo grupo
 *   (comparten empleado, fechas y autorización). Los datos compartidos se toman
 *   del primero.
 * @param itemsById Mapa `inventoryId -> equipo` para describir cada renglón.
 * @param adminNombre Nombre de quien entrega el equipo (firma "Entregado por").
 */
export async function generateLoanWord(loans: Loan[], itemsById: Record<string, Partial<InventoryItem> | undefined>, adminNombre: string) {
  if (!loans.length) return;
  const base = loans[0];
  const now = new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio = now.getFullYear();

  const logoUrl = window.location.origin + '/assets/gcm.jpg';
  const folio = base.grupoId || base.id;

  // Fotos del estado de los equipos al entregarlos: se juntan las de todos los
  // préstamos del grupo, se comprimen y se embeben como data URIs.
  const fotoPaths = loans.flatMap((l) => l.fotosEntrega || []);
  const fotos = (await Promise.all(fotoPaths.map((p) => photoToDataUrl(p)))).filter((d): d is string => !!d);

  const S = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;font-weight:bold;';

  // Renglones de la tabla de equipos (uno por préstamo del grupo).
  const filas = loans.map((l, i) => {
    const it = itemsById[l.inventoryId] || {};
    const marcaModelo = [it.marca, it.modelo].filter(Boolean).map((x) => String(x).toUpperCase()).join(' ') || '—';
    const tipo = it.tipo ? String(it.tipo).toUpperCase() : '—';
    const serie = it.serie ? String(it.serie).toUpperCase() : '—';
    const condicion = CONDICION_MAP[it.condicion || ''] || it.condicion || '';
    const bg = i % 2 ? '' : 'background:#f2f2f2;';
    return `<tr style="${bg}">
      <td style="${S}border:1px solid #000;padding:5px 7px;text-align:center;">${i + 1}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(tipo)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(marcaModelo)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml(serie)}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;">${escapeHtml((condicion || '—').toUpperCase())}</td>
      <td style="${S}border:1px solid #000;padding:5px 7px;text-align:center;">${l.cantidad || 1}</td>
    </tr>`;
  }).join('\n');

  const fotosHtml = fotos.length
    ? `<p style="${SB}margin-top:14px;margin-bottom:6px;">ESTADO DE LOS EQUIPOS AL MOMENTO DE LA ENTREGA:</p>
${fotos.map((d) => `<div style="margin:0 0 8px;"><img src="${d}" width="360" style="width:360px;height:auto;border:1px solid #000;"></div>`).join('\n')}`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<title>Prestamo ${folio}</title>
<style>
html{color-scheme:light only;}
/* Sección con pie de página (mso-footer) para que el bloque de firmas se
   repita automáticamente en TODAS las páginas del documento en Word. */
@page WordSectionLoan{size:21.59cm 27.94cm;margin:1.5cm 2cm 3.4cm 2cm;mso-footer-margin:1.0cm;mso-footer:lf1;}
div.WordSectionLoan{page:WordSectionLoan;}
body{${S}margin:0;line-height:1.5;background:#ffffff !important;}
table{${S}border-collapse:collapse;background:#ffffff !important;}
td{background:#ffffff !important;}
p{margin:0 0 9px;padding:0;color:#000 !important;}
</style>
</head>
<body style="background:#ffffff !important;color:#000 !important">
<div class="WordSectionLoan">

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

<p><b>ASUNTO:</b>&nbsp;&nbsp;PRESTAMO DE EQUIPO TECNOLOGICO.&nbsp;&nbsp;&nbsp;&nbsp;No.&nbsp;${escapeHtml(folio)}</p>

<p><b>FECHA:</b>&nbsp;&nbsp;__${dia}__de__${mes}__${anio}__.</p>

<p style="text-align:justify;line-height:1.5;margin-bottom:8px;">
POR ESTE MEDIO HACEMOS CONSTAR, QUE SE ENTREGO EN CALIDAD DE PRESTAMO EL/LOS SIGUIENTE(S) EQUIPO(S) CON LAS SIGUIENTES CARACTERISTICAS:
</p>

<table border="1" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:10px;">
<tr style="background:#d9d9d9;">
  <td style="${SB}border:1px solid #000;padding:5px 7px;text-align:center;">#</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">TIPO</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">MARCA / MODELO</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">S/N</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;">CONDICION</td>
  <td style="${SB}border:1px solid #000;padding:5px 7px;text-align:center;">CANT.</td>
</tr>
${filas}
</table>

<p><b>FECHA DE DEVOLUCION ESTIMADA:</b>&nbsp;${base.fechaDevolucionEstimada ? escapeHtml(base.fechaDevolucionEstimada) : '__________________________'}</p>

${base.notas ? `<p><b>NOTA:</b>&nbsp;${escapeHtml(String(base.notas).toUpperCase())}</p>` : ''}

<p style="text-align:justify;line-height:1.4;margin-top:10px;margin-bottom:8px;">
<b>RESPONSABILIDAD:</b>&nbsp;EL RECEPTOR SE COMPROMETE A RESGUARDAR Y UTILIZAR EL/LOS EQUIPO(S) UNICAMENTE PARA FINES LABORALES, Y A DEVOLVERLO(S) EN LAS MISMAS CONDICIONES EN QUE LO(S) RECIBIO. EN CASO DE DAÑO, PERDIDA O ROBO OCASIONADO POR NEGLIGENCIA O MAL USO, EL RECEPTOR SE HACE RESPONSABLE DE SU REPARACION O REPOSICION.
</p>

${fotosHtml}

<div style='mso-element:footer' id="lf1">
<table border="0" width="100%" cellspacing="0" cellpadding="3" style="${S}margin-top:18px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entregado por:</b><br>${escapeHtml(String(adminNombre || 'Depto. Sistemas / TI').toUpperCase())}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme:</b><br>${escapeHtml(String(base.empleado || '').toUpperCase())}
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
  a.download = `prestamo_${folio}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
