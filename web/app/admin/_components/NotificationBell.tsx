'use client';

import { useEffect, useRef } from 'react';
import { IconBell, IconBellOff, IconTrash, IconTicket } from '@tabler/icons-react';
import { useNotifications } from './NotificationsContext';

/**
 * Ícono de campana con contador de no leídas y panel desplegable de
 * notificaciones (consume {@link useNotifications}). Se cierra al hacer
 * click fuera del componente.
 * @param forceDot Fuerza a mostrar el punto/badge de notificación aunque `unread` sea 0 (usado para indicar estado sin depender del contador).
 */
export function NotificationBell({ forceDot = false }: { forceDot?: boolean }) {
  const { notifList, unread, open, setOpen, clearNotifs } = useNotifications();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 text-white transition-colors hover:bg-white/16"
      >
        <IconBell size={18} />
        {(unread > 0 || forceDot) && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-admin-brand bg-admin-red px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread > 0 ? unread : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+10px)] right-0 z-[9999] flex w-85 flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3.5 dark:border-white/10">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <IconBell size={15} className="text-admin-blue" /> Notificaciones
            </span>
            <button
              type="button"
              onClick={clearNotifs}
              title="Limpiar todo"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-admin-light hover:text-admin-red"
            >
              <IconTrash size={15} />
            </button>
          </div>
          <div className="max-h-95 overflow-y-auto">
            {notifList.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-9 text-center text-slate-400">
                <IconBellOff size={36} className="opacity-25" />
                <p className="text-[13px]">Sin notificaciones</p>
              </div>
            ) : (
              notifList.map((n, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-black/[0.07] px-4 py-3 last:border-b-0 hover:bg-admin-light dark:border-white/10 dark:hover:bg-admin-dark-alt">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${n.color}22`, color: n.color }}>
                    <IconTicket size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{n.title}</div>
                    <div className="mb-0.5 text-xs text-slate-500">{n.body}</div>
                    <div className="text-[11px] text-slate-400">{n.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
