import clsx from 'clsx';
import { IconChartBar, IconPackage, IconExchange, IconUsers, IconPlus } from '@tabler/icons-react';

/** Vista activa del módulo de inventario. */
export type InvView = 'dashboard' | 'equipos' | 'prestamos' | 'asignaciones';

interface InvToolbarProps {
  view: InvView;
  onChange: (view: InvView) => void;
  canEquipos: boolean;
  canPrestamos: boolean;
  activosCount: number;
  onAdd: () => void;
}

/**
 * Barra de navegación entre las vistas del módulo de inventario (solo
 * muestra las pestañas para las que el usuario tiene permiso) y botón de
 * acción principal contextual ("Nuevo equipo"/"Nuevo préstamo" según la vista activa).
 */
export function InvToolbar({ view, onChange, canEquipos, canPrestamos, activosCount, onAdd }: InvToolbarProps) {
  const tabBtn = (v: InvView, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={clsx(
        'flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-transparent px-4 py-2 text-[13px] font-semibold transition-all',
        view === v
          ? 'border-blue-300/50 bg-admin-blue-light text-admin-blue dark:border-admin-blue/40 dark:bg-admin-blue/15'
          : 'text-admin-text-sec hover:border-blue-200 hover:bg-admin-blue-light hover:text-admin-blue dark:text-admin-dark-text-sec dark:hover:border-admin-blue/40 dark:hover:bg-admin-blue/15'
      )}
    >
      {icon} {label}
      {!!badge && <span className="rounded-full bg-admin-amber px-1.5 py-0.5 text-[10px] font-extrabold text-white">{badge}</span>}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-admin-border bg-white p-2.5 dark:border-white/10 dark:bg-admin-dark-surface">
      <div className="flex gap-1">
        {tabBtn('dashboard', <IconChartBar size={15} />, 'Dashboard')}
        {canEquipos && tabBtn('equipos', <IconPackage size={15} />, 'Equipos')}
        {canPrestamos && tabBtn('prestamos', <IconExchange size={15} />, 'Préstamos', activosCount)}
        {canPrestamos && tabBtn('asignaciones', <IconUsers size={15} />, 'Responsables')}
      </div>
      {((view === 'equipos' && canEquipos) || (view === 'prestamos' && canPrestamos)) && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(59,130,246,0.42)]"
        >
          {view === 'equipos' ? <IconPlus size={15} /> : <IconExchange size={15} />}
          {view === 'equipos' ? 'Nuevo equipo' : 'Nuevo préstamo'}
        </button>
      )}
    </div>
  );
}
