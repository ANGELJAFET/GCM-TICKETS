'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  IconListCheck,
  IconLayoutList,
  IconCircleDot,
  IconLoader,
  IconCircleCheck,
  IconTicketOff,
  IconFilterOff,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui';
import type { Ticket, TicketStatus } from '@/lib/types';
import { IdentScreen } from './_components/IdentScreen';
import { Header } from './_components/Header';
import { Hero } from './_components/Hero';
import { TicketCard } from './_components/TicketCard';
import { NewTicketModal, type NewTicketData } from './_components/NewTicketModal';
import { QRModal, type MobileFile } from './_components/QRModal';

type FilterValue = 'todos' | TicketStatus;

const FILTERS: { value: FilterValue; label: string; icon: typeof IconLayoutList }[] = [
  { value: 'todos', label: 'Todos', icon: IconLayoutList },
  { value: 'abierto', label: 'Abiertos', icon: IconCircleDot },
  { value: 'en_progreso', label: 'En progreso', icon: IconLoader },
  { value: 'cerrado', label: 'Cerrados', icon: IconCircleCheck },
];

function PortalApp() {
  const { user, token } = usePortalAuth();
  const { showToast } = useToast();

  const { data: tickets, mutate } = useSWR<Ticket[]>(
    token ? ['/tickets', token] : null,
    ([url]: [string]) => api<Ticket[]>(url, { token }),
    { refreshInterval: 15000 }
  );

  const [filter, setFilter] = useState<FilterValue>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [mobileToken, setMobileToken] = useState<string | null>(null);
  const [mobileFile, setMobileFile] = useState<MobileFile | null>(null);

  const mine = useMemo(() => (user ? (tickets || []).filter((t) => t.reporterId === user.id) : []), [tickets, user]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { abierto: 0, en_progreso: 0, cerrado: 0 };
    mine.forEach((t) => {
      if (t.status in c) c[t.status]++;
    });
    return c;
  }, [mine]);
  const visible = filter === 'todos' ? mine : mine.filter((t) => t.status === filter);

  async function handleReply(id: string, text: string) {
    try {
      await api(`/tickets/${id}/comments`, { method: 'POST', body: { text }, token });
      await mutate();
      showToast('Respuesta enviada ✓');
    } catch {
      showToast('Error al enviar respuesta');
    }
  }

  async function handleCreateTicket(data: NewTicketData) {
    try {
      const ticket = await api<Ticket>('/tickets', {
        method: 'POST',
        token,
        body: {
          title: data.title,
          desc: data.desc || 'Sin descripción.',
          status: 'abierto',
          prioridad: data.prioridad,
          categoria: data.categoria,
          asignado: 'Sin asignar',
        },
      });

      if (data.mobileToken) {
        await api(`/tickets/${ticket.id}/attachments/from-mobile`, { method: 'POST', token, body: { token: data.mobileToken } });
      } else if (data.file) {
        const form = new FormData();
        form.append('file', data.file);
        await api(`/tickets/${ticket.id}/attachments`, { method: 'POST', token, body: form, isFormData: true });
      }

      setModalOpen(false);
      setMobileToken(null);
      setMobileFile(null);
      await mutate();
      showToast('Ticket enviado correctamente ✓');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Error al crear el ticket');
      throw err;
    }
  }

  return (
    <>
      <Header />
      <div className="relative z-1 mx-auto max-w-4xl px-5 pt-8 pb-15 max-[768px]:px-4 max-[600px]:px-3 max-[600px]:pt-5 max-[600px]:pb-17.5">
        <Hero onNuevoTicket={() => setModalOpen(true)} />

        <div className="mb-4.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-portal-text-sec uppercase">
            <IconListCheck size={15} className="text-portal-navy-mid" />
            Mis tickets
            {mine.length > 0 && (
              <span className="rounded-xl bg-linear-to-br from-portal-navy to-portal-navy-mid px-2.25 py-0.5 text-[10px] font-bold text-white">
                {mine.length}
              </span>
            )}
          </div>
          <span className="text-xs text-portal-gray max-[480px]:hidden">Solo ves tus propias solicitudes</span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map(({ value, label, icon: Icon }) => {
            const active = filter === value;
            const count = value === 'todos' ? mine.length : counts[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={
                  'flex items-center gap-1.5 rounded-[10px] border-[1.5px] px-4 py-2 text-[13px] font-semibold transition-all ' +
                  (active
                    ? 'border-transparent bg-linear-to-br from-portal-navy-dark to-portal-navy text-white shadow-[0_4px_14px_rgba(26,46,107,0.35)]'
                    : 'border-portal-border bg-white text-portal-text-sec hover:border-portal-accent hover:bg-portal-accent-light hover:text-portal-accent dark:bg-admin-dark-surface')
                }
              >
                <Icon size={14} /> {label}
                {count > 0 && (
                  <span
                    className={
                      'min-w-4.5 rounded-[10px] px-1.75 py-0.5 text-center text-[10px] font-bold ' +
                      (active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600 dark:bg-admin-dark-bg dark:text-admin-dark-text-sec')
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!user || mine.length === 0 ? (
          <div className="px-5 py-18 text-center text-portal-text-sec">
            <IconTicketOff size={64} className="mx-auto mb-5 opacity-12" />
            <h3 className="mb-2 text-lg font-extrabold tracking-tight text-portal-text">
              {user ? 'Aún no tienes tickets' : 'Crea tu primer ticket'}
            </h3>
            <p className="text-[13.5px] leading-relaxed">
              Haz clic en <strong>Nuevo ticket</strong> para reportar un problema.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-18 text-center text-portal-text-sec">
            <IconFilterOff size={64} className="mx-auto mb-5 opacity-12" />
            <h3 className="mb-2 text-lg font-extrabold tracking-tight text-portal-text">Sin tickets en este estado</h3>
            <p className="text-[13.5px] leading-relaxed">No tienes tickets con ese estado en este momento.</p>
          </div>
        ) : (
          visible.map((t) => <TicketCard key={t.id} ticket={t} onReply={handleReply} />)
        )}
      </div>

      <NewTicketModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setMobileToken(null);
          setMobileFile(null);
        }}
        onSubmit={handleCreateTicket}
        onOpenQR={() => setQrOpen(true)}
        mobileToken={mobileToken}
        mobileFile={mobileFile}
        onClearMobileFile={() => {
          setMobileToken(null);
          setMobileFile(null);
        }}
      />

      <QRModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConfirm={(tok, file) => {
          setMobileToken(tok);
          setMobileFile(file);
          showToast('Foto del celular lista para adjuntar ✓');
        }}
      />
    </>
  );
}

export default function PortalPage() {
  const { user, loading } = usePortalAuth();

  // Mientras se restaura la sesión desde sessionStorage (o si no hay sesión),
  // se muestra la pantalla de login por defecto — igual que el HTML estático
  // original, que ya traía #identScreen visible desde el primer render en
  // vez de dejar la página en blanco.
  if (loading || !user) return <IdentScreen />;
  return <PortalApp />;
}
