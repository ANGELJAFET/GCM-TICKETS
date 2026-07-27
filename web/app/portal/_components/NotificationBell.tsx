'use client';

import { useEffect, useRef } from 'react';
import { IconBell, IconBellOff, IconTrash, IconMessageCircle, IconProgressCheck } from '@tabler/icons-react';
import { usePortalNotifications } from './PortalNotificationsContext';

/**
 * Campana de notificaciones del portal de empleados: contador de no leídas y
 * panel desplegable con los avisos de cambios de estado y respuestas de
 * soporte en los tickets del propio empleado (consume {@link usePortalNotifications}).
 * Se cierra al hacer clic fuera, igual que `AccountMenu`.
 */
export function NotificationBell() {
  const { notifList, unread, open, setOpen, clearNotifs } = usePortalNotifications();
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
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-white/25 bg-white/15 text-white transition-colors hover:bg-white/22"
      >
        <IconBell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-portal-navy bg-portal-red px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+10px)] right-0 z-[9999] flex w-85 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white text-portal-text shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text">
          <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3.5 dark:border-white/10">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <IconBell size={15} className="text-portal-navy-mid" /> Notificaciones
            </span>
            {notifList.length > 0 && (
              <button
                type="button"
                onClick={clearNotifs}
                title="Limpiar todo"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-portal-bg hover:text-portal-red dark:hover:bg-admin-dark-alt"
              >
                <IconTrash size={15} />
              </button>
            )}
          </div>
          <div className="max-h-95 overflow-y-auto">
            {notifList.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-9 text-center text-slate-400">
                <IconBellOff size={36} className="opacity-25" />
                <p className="text-[13px]">Sin notificaciones</p>
              </div>
            ) : (
              notifList.map((n, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-black/[0.07] px-4 py-3 last:border-b-0 hover:bg-portal-bg dark:border-white/10 dark:hover:bg-admin-dark-alt">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${n.color}22`, color: n.color }}>
                    {n.kind === 'reply' ? <IconMessageCircle size={16} /> : <IconProgressCheck size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{n.title}</div>
                    <div className="mb-0.5 line-clamp-2 text-xs text-slate-500 dark:text-admin-dark-text-sec">{n.body}</div>
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
