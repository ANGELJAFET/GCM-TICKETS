'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { usePortalAuth } from '@/lib/auth';
import type { Ticket, TicketStatus } from '@/lib/types';

/** Tipo de evento notificado al empleado: cambio de estado o respuesta de soporte. */
export type PortalNotifKind = 'status' | 'reply';

export interface PortalNotifItem {
  kind: PortalNotifKind;
  title: string;
  body: string;
  color: string;
  ts: number;
  time: string;
}

interface PortalNotificationsContextValue {
  notifList: PortalNotifItem[];
  unread: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  clearNotifs: () => void;
  checkMyTickets: (tickets: Ticket[]) => void;
}

const PortalNotificationsContext = createContext<PortalNotificationsContextValue | null>(null);

/** Instantánea mínima de un ticket para detectar cambios entre recargas. */
interface Snapshot {
  status: TicketStatus;
  comments: number;
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  cerrado: 'Cerrado',
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  abierto: '#3b82f6',
  en_progreso: '#f59e0b',
  cerrado: '#16a34a',
};

/**
 * Centro de notificaciones en memoria del portal de empleados (últimas 50).
 * {@link PortalNotificationsContextValue.checkMyTickets} se llama tras cada
 * recarga de "mis tickets": compara contra la instantánea anterior para
 * detectar cambios de estado y respuestas nuevas de soporte (comentarios cuyo
 * autor no es el propio empleado), generando una notificación por cada uno.
 */
export function PortalNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = usePortalAuth();
  const [notifList, setNotifList] = useState<PortalNotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpenState] = useState(false);
  const prevRef = useRef<Map<string, Snapshot> | null>(null);
  const openRef = useRef(false);

  const pushNotif = useCallback((kind: PortalNotifKind, title: string, body: string, color: string) => {
    const time = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    setNotifList((prev) => [{ kind, title, body, color, ts: Date.now(), time }, ...prev].slice(0, 50));
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

  const checkMyTickets = useCallback(
    (tickets: Ticket[]) => {
      const snap = new Map<string, Snapshot>(tickets.map((t) => [t.id, { status: t.status, comments: t.comments.length }]));
      // Primera carga: solo sembramos la referencia, sin notificar el estado inicial.
      if (prevRef.current === null) {
        prevRef.current = snap;
        return;
      }
      const prev = prevRef.current;
      const nombre = user?.nombre;
      tickets.forEach((t) => {
        const before = prev.get(t.id);
        if (!before) return; // ticket nuevo (recién creado por el propio empleado): no es novedad para él.

        if (before.status !== t.status) {
          pushNotif('status', `Ticket ${STATUS_LABEL[t.status].toLowerCase()} — ${t.title}`, `Ahora está en estado "${STATUS_LABEL[t.status]}".`, STATUS_COLOR[t.status]);
        }

        if (t.comments.length > before.comments) {
          // Solo avisamos si algún comentario nuevo lo escribió soporte, no el propio empleado.
          const nuevos = t.comments.slice(before.comments);
          const respuesta = [...nuevos].reverse().find((c) => c.user !== nombre);
          if (respuesta) {
            const texto = respuesta.text.length > 80 ? respuesta.text.slice(0, 80) + '…' : respuesta.text;
            pushNotif('reply', `Nueva respuesta — ${t.title}`, `${respuesta.user}: ${texto}`, '#6366f1');
          }
        }
      });
      prevRef.current = snap;
    },
    [pushNotif, user?.nombre]
  );

  return (
    <PortalNotificationsContext.Provider value={{ notifList, unread, open, setOpen, clearNotifs, checkMyTickets }}>
      {children}
    </PortalNotificationsContext.Provider>
  );
}

/** Hook para leer/gestionar el centro de notificaciones del portal. @throws Si se usa fuera de {@link PortalNotificationsProvider}. */
export function usePortalNotifications(): PortalNotificationsContextValue {
  const ctx = useContext(PortalNotificationsContext);
  if (!ctx) throw new Error('usePortalNotifications debe usarse dentro de PortalNotificationsProvider');
  return ctx;
}
