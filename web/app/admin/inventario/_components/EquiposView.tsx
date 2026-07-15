import { IconSearch, IconPackageOff, IconPlus } from '@tabler/icons-react';
import type { InventoryItem } from '@/lib/types';
import { InvCard } from './InvCard';

interface EquiposViewProps {
  allCount: number;
  items: InventoryItem[];
  query: string;
  estado: string;
  onQueryChange: (q: string) => void;
  onEstadoChange: (e: string) => void;
  onAdd: () => void;
  onOpenSimilar: (id: string) => void;
  onLoan: (id: string) => void;
  onReturn: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EquiposView({ allCount, items, query, estado, onQueryChange, onEstadoChange, onAdd, onOpenSimilar, onLoan, onReturn, onEdit, onDelete }: EquiposViewProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-50 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-admin-gray" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por marca, modelo, serie, condición, estado, ubicación, responsable…"
            className="h-9.5 w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light pr-3.5 pl-9.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white dark:border-white/10 dark:bg-admin-dark-bg"
          />
        </div>
        <select
          value={estado}
          onChange={(e) => onEstadoChange(e.target.value)}
          className="h-9.5 rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
        >
          <option value="">Estado</option>
          <option value="disponible">Disponible</option>
          <option value="en_uso">En uso</option>
          <option value="en_prestamo">En préstamo</option>
          <option value="en_reparacion">En reparación</option>
          <option value="de_baja">De baja</option>
        </select>
      </div>

      {items.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {items.map((item) => (
            <InvCard key={item.id} item={item} onOpenSimilar={onOpenSimilar} onLoan={onLoan} onReturn={onReturn} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3.5 px-5 py-15 text-center text-admin-gray">
          <IconPackageOff size={56} className="opacity-20" />
          <p className="text-sm">{allCount ? 'No hay equipos que coincidan con los filtros.' : 'No hay equipos registrados aún.'}</p>
          {!allCount && (
            <button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)]">
              <IconPlus size={15} /> Agregar primer equipo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
