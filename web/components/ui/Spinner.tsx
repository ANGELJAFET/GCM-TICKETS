import { IconLoader2 } from '@tabler/icons-react';
import clsx from 'clsx';

interface SpinnerProps {
  label?: string;
  size?: number;
  className?: string;
}

export function Spinner({ label = 'Cargando…', size = 20, className }: SpinnerProps) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-8 text-sm text-current opacity-70', className)}>
      <IconLoader2 size={size} className="animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
