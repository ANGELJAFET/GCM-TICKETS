'use client';

import { useMemo } from 'react';
import { Doughnut, Bar, Pie } from 'react-chartjs-2';
import { IconChartDonut, IconChartBar, IconChartPie } from '@tabler/icons-react';
import '@/lib/chartSetup';
import type { Ticket } from '@/lib/types';

/**
 * Sección de gráficos del dashboard admin (Chart.js vía `react-chartjs-2`):
 * distribución de tickets por estado (dona), por técnico asignado (barras) y
 * por categoría (pie). No renderiza nada si `tickets` está vacío.
 */
export function ChartsSection({ tickets }: { tickets: Ticket[] }) {
  const { statusData, techData, catData } = useMemo(() => {
    const statusCounts: Record<string, number> = { Abierto: 0, 'En progreso': 0, Cerrado: 0 };
    const techCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};

    tickets.forEach((t) => {
      const sLabel = ({ abierto: 'Abierto', en_progreso: 'En progreso', cerrado: 'Cerrado' } as Record<string, string>)[t.status] || t.status;
      statusCounts[sLabel] = (statusCounts[sLabel] || 0) + 1;
      const tech = t.asignado || 'Sin asignar';
      techCounts[tech] = (techCounts[tech] || 0) + 1;
      const cat = t.categoria || 'Otro';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    return {
      statusData: {
        labels: Object.keys(statusCounts),
        datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'], borderWidth: 2, borderColor: '#fff' }],
      },
      techData: {
        labels: Object.keys(techCounts),
        datasets: [{ label: 'Tickets', data: Object.values(techCounts), backgroundColor: '#3b82f6', borderRadius: 6 }],
      },
      catData: {
        labels: Object.keys(catCounts),
        datasets: [{ data: Object.values(catCounts), backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 2, borderColor: '#fff' }],
      },
    };
  }, [tickets]);

  if (!tickets.length) return null;

  return (
    <div className="mb-3.5 grid grid-cols-3 gap-2 max-[900px]:grid-cols-1">
      <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-admin-text-sec uppercase dark:text-admin-dark-text-sec">
          <IconChartDonut size={14} /> Por estado
        </div>
        <div className="relative h-40">
          <Doughnut data={statusData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 8 } } } }} />
        </div>
      </div>
      <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-admin-text-sec uppercase dark:text-admin-dark-text-sec">
          <IconChartBar size={14} /> Por técnico
        </div>
        <div className="relative h-40">
          <Bar
            data={techData}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
          />
        </div>
      </div>
      <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-admin-text-sec uppercase dark:text-admin-dark-text-sec">
          <IconChartPie size={14} /> Por categoría
        </div>
        <div className="relative h-40">
          <Pie data={catData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 8 } } } }} />
        </div>
      </div>
    </div>
  );
}
