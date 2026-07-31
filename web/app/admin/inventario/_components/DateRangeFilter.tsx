import { IconCalendar, IconX } from '@tabler/icons-react';

interface DateRangeFilterProps {
  /** Fecha mínima seleccionada (`YYYY-MM-DD`), o `''` si no hay. */
  desde: string;
  /** Fecha máxima seleccionada (`YYYY-MM-DD`), o `''` si no hay. */
  hasta: string;
  onDesde: (v: string) => void;
  onHasta: (v: string) => void;
  /** Texto corto que describe qué fecha se filtra (ej. "Ingreso", "Préstamo"). */
  label?: string;
}

/**
 * Filtro de rango de fechas (Desde–Hasta) reutilizable por las vistas de
 * Equipos y Préstamos. Controlado por el padre; el filtrado real ocurre en
 * `invHelpers` (`filterInventory`/`filterLoans`) por comparación de fechas ISO.
 * Muestra un botón para limpiar el rango solo cuando hay alguna fecha puesta.
 */
export function DateRangeFilter({ desde, hasta, onDesde, onHasta, label }: DateRangeFilterProps) {
  const inputCls =
    'h-9.5 rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-2.5 text-[13px] text-admin-text-sec outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg dark:text-admin-dark-text-sec dark:[color-scheme:dark]';

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-[12px] font-semibold text-admin-gray">
        <IconCalendar size={14} /> {label || 'Fecha'}
      </span>
      <input type="date" value={desde} max={hasta || undefined} onChange={(e) => onDesde(e.target.value)} title="Desde" className={inputCls} />
      <span className="text-admin-gray">–</span>
      <input type="date" value={hasta} min={desde || undefined} onChange={(e) => onHasta(e.target.value)} title="Hasta" className={inputCls} />
      {(desde || hasta) && (
        <button
          type="button"
          onClick={() => {
            onDesde('');
            onHasta('');
          }}
          title="Limpiar fechas"
          className="flex h-6 w-6 items-center justify-center rounded-full text-admin-gray hover:bg-admin-light hover:text-admin-red dark:hover:bg-admin-dark-alt"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
