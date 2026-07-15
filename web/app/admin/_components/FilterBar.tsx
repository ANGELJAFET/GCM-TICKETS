import { IconSearch, IconFilterOff, IconFileSpreadsheet } from '@tabler/icons-react';
import type { AdminUser } from '@/lib/types';

export interface Filters {
  search: string;
  prioridad: string;
  categoria: string;
  asignado: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: Filters = { search: '', prioridad: '', categoria: '', asignado: '', dateFrom: '', dateTo: '' };

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  admins: AdminUser[];
  onExport: () => void;
}

const selectClass =
  'h-9.5 rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg dark:text-admin-dark-text';

export function FilterBar({ filters, onChange, admins, onExport }: FilterBarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-admin-border bg-white px-6 py-2.5 dark:border-white/10 dark:bg-admin-dark-surface">
      <div className="relative min-w-45 flex-1">
        <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-admin-gray" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar tickets..."
          className="h-9.5 w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light pr-3.5 pl-9.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:border-white/10 dark:bg-admin-dark-bg dark:text-admin-dark-text"
        />
      </div>
      <select value={filters.prioridad} onChange={(e) => set({ prioridad: e.target.value })} className={selectClass}>
        <option value="">Prioridad</option>
        <option value="Crítica">Crítica</option>
        <option value="Alta">Alta</option>
        <option value="Media">Media</option>
        <option value="Baja">Baja</option>
      </select>
      <select value={filters.categoria} onChange={(e) => set({ categoria: e.target.value })} className={selectClass}>
        <option value="">Categoría</option>
        <option value="Hardware">Hardware</option>
        <option value="Software">Software</option>
        <option value="Red">Red</option>
        <option value="Acceso">Acceso</option>
        <option value="Otro">Otro</option>
      </select>
      <select value={filters.asignado} onChange={(e) => set({ asignado: e.target.value })} className={selectClass}>
        <option value="">Técnico</option>
        {admins.map((a) => (
          <option key={a.id} value={a.nombre}>
            {a.nombre}
          </option>
        ))}
        <option value="Sin asignar">Sin asignar</option>
      </select>
      <input type="date" title="Desde" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className={`${selectClass} w-32.5`} />
      <input type="date" title="Hasta" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className={`${selectClass} w-32.5`} />
      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTERS)}
        title="Limpiar filtros"
        className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-admin-border bg-admin-light text-admin-text-sec transition-colors hover:border-admin-red hover:bg-admin-red-light hover:text-admin-red"
      >
        <IconFilterOff size={16} />
      </button>
      <button
        type="button"
        onClick={onExport}
        className="flex h-9.5 shrink-0 items-center gap-1.75 rounded-[10px] bg-linear-to-br from-emerald-600 to-admin-green px-4 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(16,185,129,0.45)]"
      >
        <IconFileSpreadsheet size={16} /> Excel
      </button>
    </div>
  );
}
