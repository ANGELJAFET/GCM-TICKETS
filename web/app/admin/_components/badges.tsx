import {
  IconCircleDot,
  IconLoader,
  IconCircleCheck,
  IconAlertTriangle,
  IconArrowUp,
  IconMinus,
  IconArrowDown,
  IconAlarm,
  IconClock,
} from '@tabler/icons-react';
import { Pill } from '@/components/ui';
import type { Ticket, TicketPrioridad, TicketStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; icon: typeof IconCircleDot; cls: string }> = {
    abierto: { label: 'Abierto', icon: IconCircleDot, cls: 'bg-admin-blue-light text-blue-700' },
    en_progreso: { label: 'En progreso', icon: IconLoader, cls: 'bg-admin-amber-light text-amber-800' },
    cerrado: { label: 'Cerrado', icon: IconCircleCheck, cls: 'bg-admin-green-light text-emerald-800' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <Pill className={m.cls} icon={<m.icon size={11} />}>
      {m.label}
    </Pill>
  );
}

const PRIO_MAP: Record<TicketPrioridad, { icon: typeof IconArrowUp; cls: string }> = {
  'Crítica': { icon: IconAlertTriangle, cls: 'bg-admin-red-light text-red-800' },
  Alta: { icon: IconArrowUp, cls: 'bg-admin-orange-light text-orange-800' },
  Media: { icon: IconMinus, cls: 'bg-admin-amber-light text-amber-800' },
  Baja: { icon: IconArrowDown, cls: 'bg-admin-light text-admin-gray' },
};

export function PrioBadge({ prioridad }: { prioridad: TicketPrioridad }) {
  const m = PRIO_MAP[prioridad] || PRIO_MAP.Baja;
  return (
    <Pill className={m.cls} icon={<m.icon size={11} />}>
      {prioridad}
    </Pill>
  );
}

export function Avatar({ name }: { name: string }) {
  const isUnassigned = name === 'Sin asignar';
  const initials = isUnassigned ? '?' : (name || '?').substring(0, 2).toUpperCase();
  return (
    <span
      className={
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold text-white ' +
        (isUnassigned ? 'bg-linear-to-br from-slate-500 to-slate-400' : 'bg-linear-to-br from-blue-600 to-violet-600')
      }
    >
      {initials}
    </span>
  );
}

export function SlaBadge({ ticket, now }: { ticket: Ticket; now: number }) {
  if (ticket.status === 'cerrado' || !ticket.fechaTs || !now) return null;
  const h = (now - ticket.fechaTs) / 3600000;
  if (h >= 48) {
    return (
      <Pill className="sla-critical-pulse bg-admin-red-light text-red-800" icon={<IconAlarm size={10} />}>
        SLA +{Math.floor(h)}h
      </Pill>
    );
  }
  if (h >= 24) {
    return (
      <Pill className="bg-admin-amber-light text-amber-800" icon={<IconClock size={10} />}>
        SLA {Math.floor(h)}h
      </Pill>
    );
  }
  return null;
}
