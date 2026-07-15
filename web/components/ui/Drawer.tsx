'use client';

import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

// Panel deslizante desde la derecha (usado hoy para el detalle de ticket) +
// overlay de fondo (.overlay-dim en admin.js).
export function Drawer({ open, onClose, children, className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <div
        className={clsx(
          'fixed top-0 right-0 z-50 h-full w-full max-w-md transform bg-white shadow-2xl transition-transform duration-200 dark:bg-admin-dark-surface',
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
