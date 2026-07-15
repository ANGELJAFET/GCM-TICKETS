'use client';

import { useMemo } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { IconChartBarOff, IconPlus, IconChartDonut, IconChartBar, IconChartPie, IconPackage } from '@tabler/icons-react';
import '@/lib/chartSetup';
import type { InventoryItem } from '@/lib/types';
import { INV_ESTADO_CLS, INV_ESTADO_LABEL } from '../_lib/invHelpers';

interface DashboardViewProps {
  items: InventoryItem[];
  canEquipos: boolean;
  onAddFirst: () => void;
  onGoTo: (estado: string, tipo?: string) => void;
}

const chartDefaults = {
  plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 11 }, padding: 12, usePointStyle: true } } },
  animation: { duration: 500 },
};

export function DashboardView({ items, canEquipos, onAddFirst, onGoTo }: DashboardViewProps) {
  const { estadoData, tipoData, condData, recent } = useMemo(() => {
    const byEstado: Record<string, number> = { disponible: 0, en_uso: 0, en_prestamo: 0, en_reparacion: 0, de_baja: 0 };
    const byTipo: Record<string, number> = {};
    const byCond: Record<string, number> = { nuevo: 0, excelente: 0, bueno: 0, regular: 0, danado: 0 };

    items.forEach((i) => {
      const estadoEfectivo = i.tipoManejo === 'cantidad' && (i.cantidadPrestada || 0) > 0 ? 'en_prestamo' : i.estado;
      if (estadoEfectivo in byEstado) byEstado[estadoEfectivo]++;
      byTipo[i.tipo] = (byTipo[i.tipo] || 0) + 1;
      if (i.condicion in byCond) byCond[i.condicion]++;
    });

    const tipoKeys = Object.keys(byTipo);
    const palette = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

    const recentList = [...items].sort((a, b) => (b.fechaTs || 0) - (a.fechaTs || 0)).slice(0, 8);

    return {
      estadoData: {
        keys: ['disponible', 'en_uso', 'en_prestamo', 'en_reparacion', 'de_baja'],
        data: {
          labels: ['Disponible', 'En uso', 'En préstamo', 'En reparación', 'De baja'],
          datasets: [{ data: Object.values(byEstado), backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#9ca3af'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }],
        },
      },
      tipoData: {
        keys: tipoKeys,
        data: {
          labels: tipoKeys,
          datasets: [{ data: tipoKeys.map((k) => byTipo[k]), backgroundColor: tipoKeys.map((_, i) => palette[i % palette.length]), borderRadius: 6, borderWidth: 0 }],
        },
      },
      condData: {
        keys: ['nuevo', 'excelente', 'bueno', 'regular', 'danado'],
        data: {
          labels: ['Nuevo', 'Excelente', 'Bueno', 'Regular', 'Dañado'],
          datasets: [{ data: Object.values(byCond), backgroundColor: ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }],
        },
      },
      recent: recentList,
    };
  }, [items]);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-5 py-15 text-center text-admin-gray">
        <IconChartBarOff size={56} className="opacity-20" />
        <p className="text-sm">No hay equipos registrados aún.{canEquipos ? ' Agrega el primer equipo para ver estadísticas.' : ''}</p>
        {canEquipos && (
          <button type="button" onClick={onAddFirst} className="flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)]">
            <IconPlus size={15} /> Agregar primer equipo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4.5 py-0.5">
      <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-1">
        <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-admin-text-sec">
            <IconChartDonut size={14} /> Estado de equipos
          </div>
          <div className="relative h-47.5">
            <Doughnut
              data={estadoData.data}
              options={{
                ...chartDefaults,
                cutout: '68%',
                onClick: (_, elems) => elems.length && onGoTo(estadoData.keys[elems[0].index]),
              }}
            />
          </div>
        </div>
        <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-admin-text-sec">
            <IconChartBar size={14} /> Por tipo
          </div>
          <div className="relative h-47.5">
            {tipoData.keys.length > 0 && (
              <Bar
                data={tipoData.data}
                options={{
                  ...chartDefaults,
                  indexAxis: 'y' as const,
                  plugins: { legend: { display: false } },
                  scales: { x: { grid: { display: false }, ticks: { precision: 0, font: { size: 11 } } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
                  onClick: (_, elems) => elems.length && onGoTo('', tipoData.keys[elems[0].index]),
                }}
              />
            )}
          </div>
        </div>
        <div className="rounded-[10px] border border-admin-border bg-white p-3.5 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-admin-text-sec">
            <IconChartPie size={14} /> Condición general
          </div>
          <div className="relative h-47.5">
            <Doughnut
              data={condData.data}
              options={{
                ...chartDefaults,
                cutout: '68%',
                onClick: (_, elems) => elems.length && onGoTo('', condData.keys[elems[0].index]),
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase">Últimos ingresos</div>
        <div className="flex flex-col rounded-2xl border border-admin-border bg-white px-2 dark:border-white/10 dark:bg-admin-dark-surface">
          {recent.length ? (
            recent.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b border-admin-light py-2.5 last:border-b-0 dark:border-white/8">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-admin-blue-light text-admin-blue dark:bg-admin-blue/15">
                  <IconPackage size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {i.marca} {i.modelo || ''}
                  </div>
                  <div className="text-[11px] text-admin-gray">
                    {i.id} · {i.fechaIngreso}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.25 py-0.75 text-[10px] font-bold tracking-wide uppercase ${INV_ESTADO_CLS[i.estado]}`}>{INV_ESTADO_LABEL[i.estado]}</span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-admin-gray">Sin registros</div>
          )}
        </div>
      </div>
    </div>
  );
}
