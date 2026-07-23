import clsx from 'clsx';
import { IconUser, IconMessage, IconPaperclip, IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import type { Ticket } from '@/lib/types';
import { StatusBadge, PrioBadge, SlaBadge, Avatar } from './badges';

const PRIO_BORDER: Record<string, string> = {
  'Crítica': 'border-l-admin-red',
  Alta: 'border-l-admin-orange',
  Media: 'border-l-admin-amber',
  Baja: 'border-l-admin-gray',
};

interface TicketCardProps {
  ticket: Ticket;
  selected: boolean;
  now: number;
  onClick: () => void;
}

/**
 * Tarjeta resumen de un ticket para el listado del panel admin: prioridad,
 * SLA (calculado con `now`), estado, comentarios/adjuntos y técnico asignado.
 * @param now Timestamp actual (ver `useNow`), usado para calcular el badge de SLA sin recalcular en cada render.
 */
export function TicketCard({ ticket: t, selected, now, onClick }: TicketCardProps) {
  const desc = t.desc || '';
  const truncated = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'cursor-pointer rounded-2xl border border-admin-border border-l-4 bg-white p-5 shadow-[var(--shadow-adm-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_22px_rgba(0,0,0,0.1)]',
        'dark:border-white/10 dark:bg-admin-dark-surface',
        PRIO_BORDER[t.prioridad] || 'border-l-transparent',
        selected && '!border-l-admin-blue shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-bold tracking-wide text-admin-text-sec">
            {t.id} · {t.categoria} · <IconUser size={11} className="inline align-[-1px]" /> {t.reporter || '—'}
          </div>
          <div className="text-sm font-bold text-admin-text dark:text-admin-dark-text">{t.title}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <PrioBadge prioridad={t.prioridad} />
          <SlaBadge ticket={t} now={now} />
        </div>
      </div>

      <div className="mb-2.5 text-xs leading-relaxed text-admin-text-sec">{truncated}</div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={t.status} />
        <span className="flex items-center gap-1 text-[11px] text-admin-gray">
          <IconMessage size={12} /> {t.comments.length}
        </span>
        {t.attachments?.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-admin-gray">
            <IconPaperclip size={12} /> {t.attachments.length}
          </span>
        )}
        {t.asignado === 'Sin asignar' && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-admin-red">
            <IconAlertCircle size={11} /> Sin asignar
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-admin-light pt-2.5 dark:border-white/8">
        <div className="flex items-center gap-2 text-xs text-admin-text-sec">
          <Avatar name={t.asignado} /> <span>{t.asignado}</span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-admin-gray">
          <IconCalendar size={12} /> {t.fecha}
        </span>
      </div>
    </div>
  );
}
