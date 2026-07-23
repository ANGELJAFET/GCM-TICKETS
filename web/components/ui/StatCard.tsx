import type { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  /** Clases de color del ícono/acento, ej. "bg-admin-blue-light text-admin-blue-dark". */
  colorClassName?: string;
  className?: string;
}

/** Tarjeta compacta de estadística: ícono con color de acento, valor destacado y etiqueta descriptiva. Usada en los "stats grid/row" del panel admin. */
export function StatCard({ icon, value, label, colorClassName, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_5px_rgba(0,0,0,0.04)] transition-transform hover:-translate-y-0.5',
        'dark:border-white/10 dark:bg-admin-dark-surface',
        className
      )}
    >
      <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', colorClassName)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl leading-tight font-extrabold">{value}</div>
        <div className="truncate text-xs font-medium opacity-60">{label}</div>
      </div>
    </div>
  );
}
