/**
 * Genera el comprobante de préstamo de equipo, imprimible/editable en Word:
 * un documento HTML descargado con extensión `.doc` (Word lo abre e
 * interpreta el HTML como si fuera su propio formato), sin depender de
 * ninguna librería de generación de `.docx`.
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
 * servidor (el documento queda autocontenido y se ve offline). Requiere que
 * el backend sirva `/uploads` con CORS (lo hace: `cors({ origin: true })`),
 * así el canvas no queda "tainted". Si algo falla, devuelve `null` y esa foto
 * simplemente se omite del comprobante.
 * @param path Ruta pública de la foto (`/uploads/archivo.jpg`).
 * @param maxDim Lado máximo (px) tras redimensionar, manteniendo proporción.
 * @param quality Calidad JPEG (0–1) del data URI resultante.
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
 * Genera y descarga el comprobante de préstamo (`prestamo_<id>_<inventoryId>.doc`)
 * con los datos del equipo, el empleado y la cláusula de responsabilidad,
 * listo para imprimir y firmar.
 * @param loan Préstamo a documentar.
 * @param item Datos del equipo prestado (puede venir parcial/`undefined` si ya no existe en inventario).
 * @param adminNombre Nombre de quien entrega el equipo (aparece en la firma "Entregado por").
 * @remarks Es `async`: si el préstamo tiene `fotosEntrega`, las descarga y las
 * incrusta comprimidas (data URI) en el documento antes de generarlo.
 */
export async function generateLoanWord(loan: Loan, item: Partial<InventoryItem> | undefined, adminNombre: string) {
  const it = item || {};
  const now = new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio = now.getFullYear();

  const condicion = CONDICION_MAP[it.condicion || ''] || it.condicion || '';
  const tipoDesc = [it.tipo, it.marca, it.modelo].filter(Boolean).join(' ');
  const logoUrl = window.location.origin + '/assets/gcm.jpg';

  // Fotos del estado del equipo al entregarlo: se descargan, comprimen y
  // embeben como data URIs para que el documento quede autocontenido.
  const fotos = (await Promise.all((loan.fotosEntrega || []).map((p) => photoToDataUrl(p)))).filter((d): d is string => !!d);

  const S = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:12pt;color:#000;font-weight:bold;';

  // Bloque de fotos (una por fila, con ancho acotado para no romper la página del .doc).
  // Word respeta el atributo `width` en píxeles (no `width:100%`, que expande
  // la imagen al ancho de la página). ~360px ≈ 3.75", tamaño legible sin ocupar
  // toda la hoja.
  const fotosHtml = fotos.length
    ? `<p style="${SB}margin-top:14px;margin-bottom:6px;">ESTADO DEL EQUIPO AL MOMENTO DE LA ENTREGA:</p>
${fotos.map((d) => `<div style="margin:0 0 8px;"><img src="${d}" width="360" style="width:360px;height:auto;border:1px solid #000;"></div>`).join('\n')}`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<title>Prestamo ${loan.id}</title>
<style>
html{color-scheme:light only;}
/* Sección con pie de página (mso-footer) para que el bloque de firmas se
   repita automáticamente en TODAS las páginas del documento en Word. El
   margen inferior es amplio (3.4cm) para dejar espacio a ese pie. */
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
<tr style="height:70px;">
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

${fotosHtml}

<div style='mso-element:footer' id="lf1">
<table border="0" width="100%" cellspacing="0" cellpadding="3" style="${S}margin-top:18px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entregado por:</b><br>${escapeHtml(String(adminNombre || 'Depto. Sistemas / TI').toUpperCase())}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme:</b><br>${escapeHtml(String(loan.empleado || '').toUpperCase())}
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
  a.download = `prestamo_${loan.id}_${loan.inventoryId}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
