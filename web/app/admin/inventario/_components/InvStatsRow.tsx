import { IconPackage, IconCircleCheck, IconExchange, IconTool, IconArchive } from '@tabler/icons-react';
import type { InventoryItem } from '@/lib/types';

interface InvStatsRowProps {
  items: InventoryItem[];
  onGoTo: (estado: string) => void;
}

/** Fila de tarjetas clicables (navegan a la vista "Equipos" filtrada por estado) con conteos del inventario. */
export function InvStatsRow({ items, onGoTo }: InvStatsRowProps) {
  const total = items.length;
  // Los equipos "por cantidad" (lotes) mantienen estado 'disponible' aunque
  // parte de sus unidades estén prestadas — se evalúa cantidadPrestada para
  // que sí aparezcan en "Prestados".
  const disponibles = items.filter((i) => (i.tipoManejo === 'cantidad' ? i.estado === 'disponible' && (i.cantidadTotal || 0) - i.cantidadPrestada > 0 : i.estado === 'disponible')).length;
  const prestados = items.filter((i) => (i.tipoManejo === 'cantidad' ? (i.cantidadPrestada || 0) > 0 : i.estado === 'en_prestamo')).length;
  const reparacion = items.filter((i) => i.estado === 'en_reparacion').length;
  const baja = items.filter((i) => i.estado === 'de_baja').length;

  const cards = [
    { estado: '', icon: IconPackage, val: total, lbl: 'Total equipos', cls: 'bg-admin-blue-light text-admin-blue dark:bg-admin-blue/15' },
    { estado: 'disponible', icon: IconCircleCheck, val: disponibles, lbl: 'Disponibles', cls: 'bg-admin-green-light text-admin-green dark:bg-admin-green/15' },
    { estado: 'en_prestamo', icon: IconExchange, val: prestados, lbl: 'Prestados', cls: 'bg-admin-amber-light text-admin-amber dark:bg-admin-amber/15' },
    { estado: 'en_reparacion', icon: IconTool, val: reparacion, lbl: 'En reparación', cls: 'bg-admin-red-light text-admin-red dark:bg-admin-red/15' },
    { estado: 'de_baja', icon: IconArchive, val: baja, lbl: 'De baja', cls: 'bg-admin-light text-admin-gray dark:bg-admin-dark-alt' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 max-[900px]:grid-cols-3 max-[540px]:grid-cols-2">
      {cards.map((c) => (
        <button
          key={c.lbl}
          type="button"
          onClick={() => onGoTo(c.estado)}
          className="flex items-center gap-3 rounded-2xl border border-admin-border bg-white p-3.5 text-left shadow-[var(--shadow-adm-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-adm)] dark:border-white/10 dark:bg-admin-dark-surface"
        >
          <div className={`flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl ${c.cls}`}>
            <c.icon size={20} />
          </div>
          <div>
            <div className="text-2xl leading-none font-extrabold">{c.val}</div>
            <div className="mt-0.75 text-[11px] font-medium text-admin-text-sec">{c.lbl}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
