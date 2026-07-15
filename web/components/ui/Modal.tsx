'use client';

import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

// Estructura .modal-backdrop > .modal > header/body/footer que ya usan los 7
// modales de admin.js, portada como un solo componente reutilizable.
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
          'dark:bg-admin-dark-surface',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4 dark:border-white/10">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1 text-xl leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-black/[0.07] bg-black/[0.015] px-5 py-3 dark:border-white/10 dark:bg-admin-dark-alt">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
