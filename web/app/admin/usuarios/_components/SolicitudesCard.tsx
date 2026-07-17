'use client';

import { useState } from 'react';
import { IconClipboardList, IconLock, IconInbox, IconCheck, IconX, IconMail, IconBuilding, IconMapPin, IconMap2, IconCalendar } from '@tabler/icons-react';
import { useConfirm } from '@/components/ui';
import type { Solicitud, SolicitudEstado } from '@/lib/types';

const FILTERS: { value: SolicitudEstado; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobado', label: 'Aprobadas' },
  { value: 'rechazado', label: 'Rechazadas' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SolicitudesCardProps {
  canView: boolean;
  solicitudes: Solicitud[];
  onAprobar: (id: number) => Promise<void>;
  onRechazar: (id: number, motivo: string | null) => Promise<void>;
}

export function SolicitudesCard({ canView, solicitudes, onAprobar, onRechazar }: SolicitudesCardProps) {
  const { confirm, prompt } = useConfirm();
  const [filter, setFilter] = useState<SolicitudEstado>('pendiente');
  const pendientesCount = solicitudes.filter((s) => s.estado === 'pendiente').length;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-admin-border bg-white p-5 dark:border-white/10 dark:bg-admin-dark-surface">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold">
          <IconClipboardList size={16} /> Solicitudes de acceso
        </div>
        <div className="flex flex-col items-center gap-2 py-9 text-center text-admin-gray">
          <IconLock size={28} />
          <p className="max-w-sm text-[13px]">Solo el superadministrador o un usuario con el permiso &quot;Solicitudes de registro&quot; otorgado puede ver y gestionar solicitudes de registro.</p>
        </div>
      </div>
    );
  }

  const filtered = solicitudes.filter((s) => s.estado === filter);

  return (
    <div className="rounded-2xl border border-admin-border bg-white p-5 dark:border-white/10 dark:bg-admin-dark-surface">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <IconClipboardList size={16} /> Solicitudes de acceso
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.25 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.value ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-admin-border text-admin-text-sec hover:border-indigo-400 hover:text-indigo-500'
              }`}
            >
              {f.label}
              {f.value === 'pendiente' && pendientesCount > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f.value ? 'bg-white/30' : 'bg-admin-light'}`}>{pendientesCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!filtered.length ? (
        <div className="flex flex-col items-center gap-2 py-9 text-center text-admin-gray">
          <IconInbox size={28} />
          <p className="text-[13px]">No hay solicitudes {filter === 'pendiente' ? 'pendientes' : filter === 'aprobado' ? 'aprobadas' : 'rechazadas'}</p>
        </div>
      ) : (
        filtered.map((s) => (
          <div key={s.id} className="flex flex-col gap-2 border-b border-admin-light py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between dark:border-white/8">
            <div className="flex gap-3">
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-slate-500 to-slate-400 text-sm font-bold text-white">
                {(s.nombre?.[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold">
                  {s.nombre} {s.apellido || ''} <span className="font-mono text-[11px] font-normal text-admin-gray">@{s.username}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-admin-gray">
                  {s.email && (
                    <span className="flex items-center gap-0.75">
                      <IconMail size={11} /> {s.email}
                    </span>
                  )}
                  {s.departamento && (
                    <span className="flex items-center gap-0.75">
                      <IconBuilding size={11} /> {s.departamento}
                    </span>
                  )}
                  {s.finca && (
                    <span className="flex items-center gap-0.75">
                      <IconMapPin size={11} /> {s.finca}
                    </span>
                  )}
                  {s.area && (
                    <span className="flex items-center gap-0.75">
                      <IconMap2 size={11} /> {s.area}
                    </span>
                  )}
                  <span className="flex items-center gap-0.75">
                    <IconCalendar size={11} /> {fmtDate(s.created_at)}
                  </span>
                </div>
                {s.mensaje && <div className="mt-1.5 text-[12px] text-admin-text-sec italic">&quot;{s.mensaje}&quot;</div>}
                <div className="mt-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.estado === 'pendiente' ? 'bg-admin-amber-light text-admin-amber' : s.estado === 'aprobado' ? 'bg-admin-green-light text-admin-green' : 'bg-admin-red-light text-admin-red'
                    }`}
                  >
                    {s.estado === 'pendiente' ? 'Pendiente' : s.estado === 'aprobado' ? 'Aprobada' : 'Rechazada'}
                  </span>
                </div>
              </div>
            </div>
            {s.estado === 'pendiente' && (
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Aprobar solicitud',
                      message: '¿Aprobar esta solicitud y crear la cuenta de usuario?',
                      confirmText: 'Aprobar',
                    });
                    if (ok) onAprobar(s.id);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-85"
                >
                  <IconCheck size={12} /> Aprobar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const motivo = await prompt({
                      title: 'Rechazar solicitud',
                      message: 'Indica el motivo del rechazo (opcional):',
                      placeholder: 'Motivo…',
                      confirmText: 'Rechazar',
                      danger: true,
                    });
                    if (motivo === null) return;
                    onRechazar(s.id, motivo);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-85"
                >
                  <IconX size={12} /> Rechazar
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
