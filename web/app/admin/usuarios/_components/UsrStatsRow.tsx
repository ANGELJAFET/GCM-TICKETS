import { IconUsers, IconUserCheck, IconUserOff, IconMailOpened } from '@tabler/icons-react';
import { StatCard } from '@/components/ui';
import type { Solicitud, Usuario } from '@/lib/types';

export function UsrStatsRow({ usuarios, solicitudes }: { usuarios: Usuario[]; solicitudes: Solicitud[] }) {
  const activos = usuarios.filter((u) => u.activo).length;
  const inactivos = usuarios.filter((u) => !u.activo).length;
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente').length;

  return (
    <div className="grid grid-cols-4 gap-2.5 max-[700px]:grid-cols-2">
      <StatCard icon={<IconUsers size={18} className="text-admin-blue" />} value={usuarios.length} label="Total usuarios" colorClassName="bg-admin-blue-light" />
      <StatCard icon={<IconUserCheck size={18} className="text-admin-green" />} value={activos} label="Activos" colorClassName="bg-admin-green-light" />
      <StatCard icon={<IconUserOff size={18} className="text-admin-red" />} value={inactivos} label="Inactivos" colorClassName="bg-admin-red-light" />
      <StatCard icon={<IconMailOpened size={18} className="text-admin-amber" />} value={pendientes} label="Solicitudes pendientes" colorClassName="bg-admin-amber-light" />
    </div>
  );
}
