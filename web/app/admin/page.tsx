'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { IconLayoutList, IconCircleDot, IconLoader, IconCircleCheck } from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useNow } from '@/lib/useNow';
import { useToast, Tabs } from '@/components/ui';
import type { AdminUser, Ticket, TicketStatus } from '@/lib/types';
import { LoginScreen } from './_components/LoginScreen';
import { Header } from './_components/Header';
import { StatsGrid } from './_components/StatsGrid';
import { ChartsSection } from './_components/ChartsSection';
import { FilterBar, EMPTY_FILTERS, type Filters } from './_components/FilterBar';
import { TicketList } from './_components/TicketList';
import { DetailDrawer } from './_components/DetailDrawer';
import { useNotifications } from './_components/NotificationsContext';
import { exportTicketsToExcel } from './_lib/exportExcel';

type TabValue = 'todos' | TicketStatus;

const TABS: { value: TabValue; label: string; icon: typeof IconLayoutList }[] = [
  { value: 'todos', label: 'Todos', icon: IconLayoutList },
  { value: 'abierto', label: 'Abiertos', icon: IconCircleDot },
  { value: 'en_progreso', label: 'En progreso', icon: IconLoader },
  { value: 'cerrado', label: 'Cerrados', icon: IconCircleCheck },
];

/**
 * Contenido autenticado del panel admin (bandeja de tickets): tabs por
 * estado, filtros, stats, gráficos, listado paginado y drawer de detalle.
 * Refresca los tickets cada 10s vía SWR (`refreshInterval`) y usa ese mismo
 * refresco para alimentar el centro de notificaciones ({@link useNotifications})
 * y el indicador de alerta de SLA en el header.
 */
function AdminApp() {
  const { user, token } = useAdminAuth();
  const { showToast } = useToast();
  const { checkNewTickets } = useNotifications();
  const searchParams = useSearchParams();

  const { data: tickets, mutate } = useSWR<Ticket[]>(token ? ['/tickets', token] : null, ([url]: [string]) => api<Ticket[]>(url, { token }), {
    refreshInterval: 10000,
  });
  const { data: admins } = useSWR<AdminUser[]>(token ? ['/admins', token] : null, ([url]: [string]) => api<AdminUser[]>(url, { token }));
  const now = useNow(60000);

  const list = useMemo(() => tickets || [], [tickets]);
  const adminList = useMemo(() => admins || [], [admins]);

  useEffect(() => {
    if (tickets) checkNewTickets(tickets);
  }, [tickets, checkNewTickets]);

  const [tab, setTab] = useState<TabValue>('todos');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep link desde el detalle de usuario ("Ver ticket" en /admin/usuarios
  // navega aquí con ?ticket=ID) — se abre en cuanto el ticket está cargado.
  // Se difiere a un microtask para que el cuerpo del efecto no dispare
  // setState de forma síncrona (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    const ticketParam = searchParams.get('ticket');
    if (!ticketParam) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && list.some((t) => t.id === ticketParam)) setSelectedId(ticketParam);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, list.length]);

  const counts = useMemo(() => {
    const c = { todos: list.length, abierto: 0, en_progreso: 0, cerrado: 0 };
    list.forEach((t) => {
      if (t.status in c) c[t.status as keyof typeof c]++;
    });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
    const dateTo = filters.dateTo ? new Date(filters.dateTo).getTime() + 86399999 : null;

    return list.filter((t) => {
      if (tab !== 'todos' && t.status !== tab) return false;
      if (filters.prioridad && t.prioridad !== filters.prioridad) return false;
      if (filters.categoria && t.categoria !== filters.categoria) return false;
      if (filters.asignado && t.asignado !== filters.asignado) return false;
      if (dateFrom && t.fechaTs < dateFrom) return false;
      if (dateTo && t.fechaTs > dateTo) return false;
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !(t.desc || '').toLowerCase().includes(q) &&
        !t.id.toLowerCase().includes(q) &&
        !(t.reporter || '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [list, tab, filters]);

  const slaAlert = useMemo(
    () => (now ? list.filter((t) => t.status !== 'cerrado' && t.fechaTs && now - t.fechaTs >= 86400000).length : 0),
    [list, now]
  );

  const selectedTicket = list.find((t) => t.id === selectedId) || null;

  function changeTab(next: TabValue) {
    setTab(next);
    setCurrentPage(1);
  }

  async function handleReassign(id: string, val: string) {
    try {
      await api(`/tickets/${id}`, { method: 'PATCH', token, body: { asignado: val } });
      showToast('Asignado a ' + val);
      await mutate();
    } catch {
      showToast('Error al asignar');
    }
  }

  async function handleChangeStatus(id: string, status: string) {
    try {
      await api(`/tickets/${id}`, { method: 'PATCH', token, body: { status } });
      showToast('Estado actualizado ✓');
      await mutate();
    } catch {
      showToast('Error al actualizar estado');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/tickets/${id}`, { method: 'DELETE', token });
      setSelectedId(null);
      showToast('Ticket eliminado');
      await mutate();
    } catch {
      showToast('Error al eliminar');
    }
  }

  async function handleAddComment(id: string, text: string) {
    try {
      await api(`/tickets/${id}/comments`, { method: 'POST', token, body: { text } });
      showToast('Respuesta enviada ✓');
      await mutate();
    } catch {
      showToast('Error al enviar respuesta');
    }
  }

  async function handleAddNote(id: string, text: string) {
    try {
      await api(`/tickets/${id}/notes`, { method: 'POST', token, body: { text } });
      showToast('Nota guardada ✓');
      await mutate();
    } catch {
      showToast('Error al guardar nota');
    }
  }

  function handleExport() {
    if (!list.length) {
      showToast('No hay tickets para exportar');
      return;
    }
    exportTicketsToExcel(list);
    showToast('Excel exportado correctamente ✓');
  }

  return (
    <div className="flex h-screen flex-col">
      <Header hasSlaAlert={slaAlert > 0} />

      <Tabs
        items={TABS.map((t) => ({
          value: t.value,
          label: (
            <span className="flex items-center gap-1.5">
              <t.icon size={15} /> {t.label}
            </span>
          ),
          badge: (
            <span className={'rounded-full px-1.75 py-0.5 text-[10px] font-bold text-white ' + (tab === t.value ? 'bg-admin-blue' : 'bg-admin-gray')}>
              {counts[t.value]}
            </span>
          ),
        }))}
        value={tab}
        onChange={changeTab}
        activeClassName="text-admin-blue border-admin-blue"
        className="shrink-0 overflow-x-auto bg-white px-5 dark:bg-admin-dark-surface"
      />

      <FilterBar filters={filters} onChange={setFilters} admins={adminList} onExport={handleExport} />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <StatsGrid tickets={list} />
        {tab === 'todos' && <ChartsSection tickets={list} />}
        <TicketList
          list={filtered}
          currentTab={tab}
          adminNombre={user?.nombre || ''}
          selectedId={selectedId}
          currentPage={currentPage}
          now={now}
          onPageChange={setCurrentPage}
          onSelect={setSelectedId}
        />
      </div>

      <DetailDrawer
        ticket={selectedTicket}
        open={!!selectedTicket}
        now={now}
        onClose={() => setSelectedId(null)}
        admins={adminList}
        onReassign={handleReassign}
        onChangeStatus={handleChangeStatus}
        onDelete={handleDelete}
        onAddComment={handleAddComment}
        onAddNote={handleAddNote}
      />
    </div>
  );
}

/**
 * Página `/admin` (bandeja de tickets, ruta raíz del panel). Muestra
 * {@link LoginScreen} si no hay sesión; si la hay, monta {@link AdminApp}
 * dentro de un `Suspense` (requerido por `useSearchParams`, usado para el
 * deep-link `?ticket=ID` que abre un ticket específico al llegar desde otra página).
 */
export default function AdminPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <LoginScreen />;
  return (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  );
}
