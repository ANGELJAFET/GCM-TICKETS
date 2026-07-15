import { IconTicket, IconCircleDot, IconLoader, IconCircleCheck, IconUserOff, IconAlertTriangle } from '@tabler/icons-react';
import { StatCard } from '@/components/ui';
import type { Ticket } from '@/lib/types';

export function StatsGrid({ tickets }: { tickets: Ticket[] }) {
  const counts = { abierto: 0, en_progreso: 0, cerrado: 0 };
  tickets.forEach((t) => {
    if (t.status in counts) counts[t.status as keyof typeof counts]++;
  });
  const sinAsignar = tickets.filter((t) => t.asignado === 'Sin asignar').length;
  const criticos = tickets.filter((t) => t.prioridad === 'Crítica' && t.status !== 'cerrado').length;

  return (
    <div className="mb-3 grid grid-cols-6 gap-2 max-[1000px]:grid-cols-3 max-[500px]:grid-cols-2">
      <StatCard icon={<IconTicket size={16} className="text-admin-blue" />} value={tickets.length} label="Total tickets" colorClassName="bg-admin-blue-light dark:bg-admin-blue/15" />
      <StatCard icon={<IconCircleDot size={16} className="text-admin-amber" />} value={counts.abierto} label="Abiertos" colorClassName="bg-admin-amber-light dark:bg-admin-amber/15" />
      <StatCard icon={<IconLoader size={16} className="text-admin-red" />} value={counts.en_progreso} label="En progreso" colorClassName="bg-admin-red-light dark:bg-admin-red/15" />
      <StatCard icon={<IconCircleCheck size={16} className="text-admin-green" />} value={counts.cerrado} label="Cerrados" colorClassName="bg-admin-green-light dark:bg-admin-green/15" />
      <StatCard icon={<IconUserOff size={16} className="text-admin-purple" />} value={sinAsignar} label="Sin asignar" colorClassName="bg-admin-purple-light dark:bg-admin-purple/15" />
      <StatCard icon={<IconAlertTriangle size={16} className="text-admin-orange" />} value={criticos} label="Críticos activos" colorClassName="bg-admin-orange-light dark:bg-admin-orange/15" />
    </div>
  );
}
