import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Clase de color para el estado activo, ej. "text-admin-blue border-admin-blue". */
  activeClassName?: string;
  className?: string;
}

/**
 * Barra de pestañas controlada, genérica en el tipo de valor `T` (union de
 * strings) para que el consumidor tenga autocompletado/type-safety sobre
 * sus propios valores de pestaña.
 * @param props.items Pestañas a mostrar, en orden.
 * @param props.value Valor de la pestaña activa (controlado por el consumidor).
 * @param props.onChange Se llama con el `value` de la pestaña clickeada.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  activeClassName = 'text-admin-blue border-admin-blue',
  className,
}: TabsProps<T>) {
  return (
    <div className={clsx('flex gap-1 border-b border-black/[0.07] dark:border-white/10', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={clsx(
              'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
              active ? activeClassName : 'border-transparent text-current opacity-60 hover:opacity-100'
            )}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
