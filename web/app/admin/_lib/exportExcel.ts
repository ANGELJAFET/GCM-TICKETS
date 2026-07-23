import * as XLSX from 'xlsx';
import type { Ticket } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_progreso: 'En progreso', cerrado: 'Cerrado' };

/**
 * Genera y descarga (vía `XLSX.writeFile`) un libro de Excel con el listado
 * completo de tickets (hoja "Tickets") y un resumen agregado por estado,
 * prioridad, categoría y técnico asignado (hoja "Resumen").
 * @param tickets Tickets a exportar (normalmente ya filtrados según lo visible en pantalla).
 */
export function exportTicketsToExcel(tickets: Ticket[]) {
  const wb = XLSX.utils.book_new();

  const headers = ['ID', 'Título', 'Descripción', 'Estado', 'Prioridad', 'Categoría', 'Asignado a', 'Reportado por', 'Fecha', '# Comentarios', '# Notas internas', '# Archivos', 'Último mensaje'];
  const rows = tickets.map((t) => [
    t.id,
    t.title,
    t.desc,
    STATUS_LABEL[t.status] || t.status,
    t.prioridad,
    t.categoria,
    t.asignado || 'Sin asignar',
    t.reporter || '—',
    t.fecha,
    t.comments.length,
    (t.notes || []).length,
    (t.attachments || []).length,
    t.comments.length ? t.comments[t.comments.length - 1].text : '',
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws1['!cols'] = [
    { wch: 9 }, { wch: 40 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Tickets');

  const cnts: Record<string, number> = { abierto: 0, en_progreso: 0, cerrado: 0 };
  const byPrio: Record<string, number> = { 'Crítica': 0, Alta: 0, Media: 0, Baja: 0 };
  const byCat: Record<string, number> = { Hardware: 0, Software: 0, Red: 0, Acceso: 0, Otro: 0 };
  const byAsig: Record<string, number> = {};

  tickets.forEach((t) => {
    if (cnts[t.status] !== undefined) cnts[t.status]++;
    if (byPrio[t.prioridad] !== undefined) byPrio[t.prioridad]++;
    if (byCat[t.categoria] !== undefined) byCat[t.categoria]++;
    const k = t.asignado || 'Sin asignar';
    byAsig[k] = (byAsig[k] || 0) + 1;
  });

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['RESUMEN — SISTEMA DE SOPORTE TÉCNICO', ''],
    ['Generado el:', new Date().toLocaleString('es-HN')],
    ['Total de tickets:', tickets.length],
    ['', ''],
    ['POR ESTADO', 'Cantidad'],
    ['Abiertos', cnts.abierto],
    ['En progreso', cnts.en_progreso],
    ['Cerrados', cnts.cerrado],
    ['', ''],
    ['POR PRIORIDAD', 'Cantidad'],
    ['Crítica', byPrio['Crítica']],
    ['Alta', byPrio['Alta']],
    ['Media', byPrio['Media']],
    ['Baja', byPrio['Baja']],
    ['', ''],
    ['POR CATEGORÍA', 'Cantidad'],
    ['Hardware', byCat['Hardware']],
    ['Software', byCat['Software']],
    ['Red', byCat['Red']],
    ['Acceso', byCat['Acceso']],
    ['Otro', byCat['Otro']],
    ['', ''],
    ['POR TÉCNICO ASIGNADO', 'Tickets'],
    ...Object.entries(byAsig).sort((a, b) => b[1] - a[1]),
  ]);
  ws2['!cols'] = [{ wch: 32 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  XLSX.writeFile(wb, `tickets_soporte_${new Date().toISOString().split('T')[0]}.xlsx`);
}
