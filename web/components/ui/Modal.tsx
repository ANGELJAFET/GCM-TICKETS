'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Modal centrado con backdrop, header opcional (título + botón cerrar),
 * cuerpo con scroll propio y footer opcional (normalmente botones de acción).
 * Se cierra con click en el backdrop o con la tecla `Escape`. Retorna `null`
 * mientras `open` es `false` (no queda montado en el DOM).
 *
 * Se renderiza en un portal a `document.body`: `position: fixed` deja de
 * posicionarse respecto al viewport si algún ancestro tiene `transform`
 * (ej. una tarjeta con `hover:-translate-y-0.5`), lo que rompía el tamaño y
 * la posición del modal al usarlo dentro de ese tipo de contenedores. El
 * portal evita depender de en qué parte del árbol se monte este componente.
 *
 * Como consecuencia de portar a `document.body`, el contenido ya no
 * hereda el color de texto que ponen `admin/layout.tsx` o
 * `portal/layout.tsx` en un ancestro — por eso la tarjeta blanca fija
 * aquí su propio color base (`text-admin-text dark:text-admin-dark-text`;
 * los valores dark de admin y portal son idénticos, ver globals.css) para
 * que cualquier texto sin clase de color propia siga leyéndose bien en
 * ambos temas, sin importar si el modal se usa en el panel admin o en
 * el portal de empleados.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-admin-text shadow-2xl',
          'dark:bg-admin-dark-surface dark:text-admin-dark-text',
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
    </div>,
    document.body
  );
}
