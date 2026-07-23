import clsx from 'clsx';
import type { ReactNode } from 'react';

interface PillProps {
  children: ReactNode;
  /** Clases de color (bg + text) del consumidor, ej. "bg-admin-blue-light text-admin-blue-dark". */
  className?: string;
  icon?: ReactNode;
}

/** Etiqueta pequeña en forma de píldora, usada para estados/roles/badges cortos. El color lo define `className` (el componente no trae colores propios). */
export function Pill({ children, className, icon }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
