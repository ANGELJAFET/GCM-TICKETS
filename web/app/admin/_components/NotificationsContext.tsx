'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { Ticket } from '@/lib/types';

export interface NotifItem {
  icon: string;
  title: string;
  body: string;
  color: string;
  ts: number;
  time: string;
}

interface NotificationsContextValue {
  notifList: NotifItem[];
  unread: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  clearNotifs: () => void;
  checkNewTickets: (tickets: Ticket[]) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifList, setNotifList] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpenState] = useState(false);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const openRef = useRef(false);

  const pushNotif = useCallback((icon: string, title: string, body: string, color: string) => {
    const time = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    setNotifList((prev) => [{ icon, title, body, color, ts: Date.now(), time }, ...prev].slice(0, 50));
    if (!openRef.current) setUnread((u) => u + 1);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    openRef.current = next;
    setOpenState(next);
    if (next) setUnread(0);
  }, []);

  const clearNotifs = useCallback(() => {
    setNotifList([]);
    setUnread(0);
  }, []);

  const checkNewTickets = useCallback(
    (tickets: Ticket[]) => {
      const ids = new Set(tickets.map((t) => t.id));
      if (prevIdsRef.current === null) {
        prevIdsRef.current = ids;
        return;
      }
      const prev = prevIdsRef.current;
      const newIds = [...ids].filter((id) => !prev.has(id));
      newIds.forEach((id) => {
        const t = tickets.find((x) => x.id === id);
        if (!t) return;
        pushNotif('ti-ticket', `Nuevo ticket — ${t.title}`, `${t.reporter} · ${t.categoria} · ${t.prioridad}`, '#3b82f6');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`Nuevo ticket — ${t.title}`, { body: `${t.reporter} · ${t.categoria} · ${t.prioridad}` });
        }
      });
      prevIdsRef.current = ids;
    },
    [pushNotif]
  );

  return (
    <NotificationsContext.Provider value={{ notifList, unread, open, setOpen, clearNotifs, checkNewTickets }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider');
  return ctx;
}
