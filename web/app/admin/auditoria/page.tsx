'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  IconHistory,
  IconX,
  IconTicket,
  IconPackage,
  IconArrowsExchange,
  IconUser,
  IconUserCheck,
  IconUserCircle,
  IconPoint,
} from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { Header } from '../_components/Header';
import { LoginScreen } from '../_components/LoginScreen';

const ENTIDAD_ICON: Record<string, typeof IconTicket> = {
  ticket: IconTicket,
  inventario: IconPackage,
  prestamo: IconArrowsExchange,
  usuario: IconUser,
  solicitud: IconUserCheck,
};
const ENTIDAD_COLOR: Record<string, string> = {
  ticket: '#3b82f6',
  inventario: '#8b5cf6',
  prestamo: '#f59e0b',
  usuario: '#10b981',
  solicitud: '#06b6d4',
};

interface AuditFilters {
  actor: string;
  entidad: string;
  desde: string;
  hasta: string;
}

const EMPTY_FILTERS: AuditFilters = { actor: '', entidad: '', desde: '', hasta: '' };

function AuditoriaApp() {
  const { token } = useAdminAuth();
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);

  const query = new URLSearchParams({ limit: '300' });
  if (filters.actor) query.set('actor', filters.actor);
  if (filters.entidad) query.set('entidad', filters.entidad);
  if (filters.desde) query.set('desde', filters.desde);
  if (filters.hasta) query.set('hasta', filters.hasta);

  const { data } = useSWR<AuditEntry[]>(token ? [`/auditoria?${query.toString()}`, token] : null, ([url]: [string]) => api<AuditEntry[]>(url, { token }));
  const rows = useMemo(() => data || [], [data]);

  const actores = useMemo(() => [...new Set(rows.map((r) => r.actor).filter((a): a is string => !!a))].sort(), [rows]);

  function set<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="mb-4.5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-lg font-bold">
              <IconHistory size={20} /> Bitácora del Sistema
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                list="audit-actors-list"
                value={filters.actor}
                onChange={(e) => set('actor', e.target.value)}
                placeholder="Filtrar por usuario…"
                className="h-9 rounded-lg border-[1.5px] border-admin-border px-2.75 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
              />
              <datalist id="audit-actors-list">
                {actores.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <select
                value={filters.entidad}
                onChange={(e) => set('entidad', e.target.value)}
                className="h-9 rounded-lg border-[1.5px] border-admin-border px-2.75 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
              >
                <option value="">Todas las áreas</option>
                <option value="ticket">Tickets</option>
                <option value="inventario">Inventario</option>
                <option value="prestamo">Préstamos</option>
                <option value="usuario">Usuarios</option>
                <option value="solicitud">Solicitudes</option>
              </select>
              <input
                type="date"
                value={filters.desde}
                onChange={(e) => set('desde', e.target.value)}
                className="h-9 rounded-lg border-[1.5px] border-admin-border px-2.75 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
              />
              <input
                type="date"
                value={filters.hasta}
                onChange={(e) => set('hasta', e.target.value)}
                className="h-9 rounded-lg border-[1.5px] border-admin-border px-2.75 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
              />
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                title="Limpiar filtros"
                className="flex h-9 items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border px-3 text-[13px] font-semibold text-admin-text-sec hover:bg-admin-light dark:border-white/10"
              >
                <IconX size={14} /> Limpiar
              </button>
            </div>
          </div>

          <div className="mb-3 text-[13px] text-admin-text-sec">
            {rows.length} registro{rows.length !== 1 ? 's' : ''}
          </div>

          {!rows.length ? (
            <div className="flex flex-col items-center gap-2 py-15 text-center text-admin-gray">
              <IconHistory size={40} className="opacity-30" />
              <p className="text-sm">No hay registros en la bitácora</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-admin-border dark:border-white/10">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="border-b border-admin-border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-admin-text-sec dark:border-white/10 dark:bg-admin-dark-alt">Fecha / Hora</th>
                    <th className="border-b border-admin-border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-admin-text-sec dark:border-white/10 dark:bg-admin-dark-alt">Usuario</th>
                    <th className="border-b border-admin-border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-admin-text-sec dark:border-white/10 dark:bg-admin-dark-alt">Área</th>
                    <th className="border-b border-admin-border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-admin-text-sec dark:border-white/10 dark:bg-admin-dark-alt">Acción / Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const Icon = (r.entidad && ENTIDAD_ICON[r.entidad]) || IconPoint;
                    const color = (r.entidad && ENTIDAD_COLOR[r.entidad]) || '#64748b';
                    const fecha = new Date(r.fecha);
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-admin-dark-alt">
                        <td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{fecha.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-[11px] text-admin-text-sec">{fecha.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
                          {r.actor ? (
                            <span className="flex items-center gap-1.25">
                              <IconUserCircle size={14} className="text-admin-text-sec" /> {r.actor}
                            </span>
                          ) : (
                            <span className="text-admin-text-sec">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <span className="inline-flex items-center gap-1 rounded-full px-2.25 py-0.75 text-[11px] font-semibold" style={{ background: `${color}20`, color }}>
                            <Icon size={12} /> {r.entidad || '—'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="flex flex-col gap-0.75">
                            <span className="font-semibold">{r.accion}</span>
                            {r.detalle && <span className="text-xs text-admin-text-sec">{r.detalle}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditoriaPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <LoginScreen />;
  return <AuditoriaApp />;
}
