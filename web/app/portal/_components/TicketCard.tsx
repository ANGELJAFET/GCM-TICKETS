'use client';

import { useState } from 'react';
import {
  IconCircleDot,
  IconLoader,
  IconCircleCheck,
  IconUserCircle,
  IconHeadset,
  IconUserCheck,
  IconUserOff,
  IconCalendar,
  IconMessages,
  IconMessageReply,
  IconSend,
  IconPhoto,
  IconVideo,
  IconPaperclip,
} from '@tabler/icons-react';
import type { Ticket, TicketComment } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_progreso: 'En progreso', cerrado: 'Cerrado' };
const STATUS_ICON: Record<string, typeof IconCircleDot> = {
  abierto: IconCircleDot,
  en_progreso: IconLoader,
  cerrado: IconCircleCheck,
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  abierto: 'bg-[#e3eaf8] text-portal-navy badge-pulse-abierto',
  en_progreso: 'bg-portal-amber-light text-amber-800',
  cerrado: 'bg-portal-green-light text-emerald-800',
};
const PRIO_BADGE_CLASS: Record<string, string> = {
  'Crítica': 'bg-portal-red-light text-red-800',
  Alta: 'bg-orange-100 text-orange-800',
  Media: 'bg-portal-amber-light text-amber-800',
  Baja: 'border border-portal-border bg-slate-50 text-portal-gray',
};
const PROGRESS_LABEL: Record<string, string> = { cerrado: 'Resuelto ✓', en_progreso: 'En atención', abierto: 'En espera' };
const PROGRESS_FILL: Record<string, string> = {
  abierto: 'w-[15%] bg-linear-to-r from-[#a8bde8] to-portal-accent',
  en_progreso: 'w-[55%] bg-linear-to-r from-amber-300 to-portal-amber',
  cerrado: 'w-full bg-linear-to-r from-emerald-300 to-portal-green',
};

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}
function isVideo(name: string) {
  return /\.(mp4|mov|avi|webm|3gp)$/i.test(name);
}

function CommentItem({ c }: { c: TicketComment }) {
  const isUser = c.rolNivel < 2;
  return (
    <div
      className={
        'mb-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ' +
        (isUser ? 'border border-[#c4d0ea] bg-portal-accent-light' : 'border border-portal-border bg-[#f5f7fc]')
      }
    >
      {isUser ? (
        <IconUserCircle size={12} className="mr-1 inline-block align-[-1px] text-portal-accent" />
      ) : (
        <IconHeadset size={12} className="mr-1 inline-block align-[-1px] text-portal-gray" />
      )}
      <strong>{isUser ? c.user || '—' : 'Soporte Técnico'}</strong> ({c.ts}): {c.text}
    </div>
  );
}

interface TicketCardProps {
  ticket: Ticket;
  onReply: (id: string, text: string) => Promise<void>;
}

export function TicketCard({ ticket: t, onReply }: TicketCardProps) {
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState(false);
  const [sending, setSending] = useState(false);

  const StatusIcon = STATUS_ICON[t.status] || IconCircleDot;

  async function submitReply() {
    const txt = replyText.trim();
    if (!txt) {
      setReplyError(true);
      return;
    }
    setReplyError(false);
    setSending(true);
    await onReply(t.id, txt);
    setSending(false);
    setReplyText('');
  }

  return (
    <div className="ticket-card mb-3.5 rounded-[18px] border border-portal-border bg-white py-5.5 pr-6 pl-7 shadow-[var(--shadow-portal-sm)] transition-all hover:-translate-y-0.5 hover:border-[rgba(26,46,107,0.28)] hover:shadow-[0_8px_32px_rgba(26,46,107,0.14),0_2px_6px_rgba(26,46,107,0.07)] max-[768px]:py-4.5 max-[768px]:pr-5 max-[768px]:pl-6 dark:bg-admin-dark-surface">
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div>
          <div className="mb-1.5 inline-block rounded-[7px] border border-portal-navy-dark bg-portal-navy px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-[#e8edf8]">
            {t.id} · {t.categoria}
          </div>
          <div className="text-[15px] leading-snug font-bold tracking-tight">{t.title}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.75 py-1 text-[11px] font-bold whitespace-nowrap ${STATUS_BADGE_CLASS[t.status] || ''}`}>
          <StatusIcon size={11} /> {STATUS_LABEL[t.status] || t.status}
        </span>
      </div>

      <div className="mb-4 text-[13px] leading-relaxed text-portal-text-sec">{t.desc}</div>

      {t.attachments?.length > 0 && (
        <div className="mt-3 mb-1 flex flex-wrap gap-2">
          {t.attachments.map((a, i) =>
            isImage(a.name) ? (
              <a
                key={i}
                href={a.path}
                target="_blank"
                rel="noreferrer"
                title={a.name}
                className="flex max-w-45 flex-col items-center gap-1 overflow-hidden rounded-[10px] border-[1.5px] border-portal-border bg-slate-50 transition-all hover:border-portal-navy hover:shadow-[0_4px_14px_rgba(26,46,107,0.18)]"
              >
                {/* Adjuntos son archivos subidos dinámicamente al backend — next/image exige dominios configurados, un <img> plano es más simple aquí. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.path} alt={a.name} className="block max-h-32.5 w-full max-w-45 object-cover" />
                <span className="max-w-45 truncate px-2 py-1 text-center text-[10px] font-semibold text-portal-text-sec">
                  <IconPhoto size={10} className="inline" /> {a.name}
                </span>
              </a>
            ) : isVideo(a.name) ? (
              <div key={i} className="flex max-w-55 flex-col items-center gap-1 overflow-hidden rounded-[10px] border-[1.5px] border-portal-border bg-slate-50">
                <video src={a.path} controls preload="metadata" className="block max-h-35 bg-black" />
                <span className="max-w-55 truncate px-2 py-1 text-center text-[10px] font-semibold text-portal-text-sec">
                  <IconVideo size={10} className="inline" /> {a.name}
                </span>
              </div>
            ) : (
              <a
                key={i}
                href={a.path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-portal-border bg-slate-50 px-2.75 py-1 text-[11px] font-semibold text-portal-accent hover:border-blue-200 hover:bg-portal-accent-light"
              >
                <IconPaperclip size={11} /> {a.name}
              </a>
            )
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.75 py-1 text-[10px] font-bold ${PRIO_BADGE_CLASS[t.prioridad] || ''}`}>{t.prioridad}</span>
          {t.asignado && t.asignado !== 'Sin asignar' ? (
            <span className="flex items-center gap-1 text-[11px] text-portal-text-sec">
              <IconUserCheck size={12} /> Equipo de Soporte
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-portal-red">
              <IconUserOff size={12} /> Sin asignar
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-portal-gray">
          <IconCalendar size={12} /> {t.fecha}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex justify-between text-[11px] font-semibold text-portal-text-sec">
          <span>Progreso</span>
          <span>{PROGRESS_LABEL[t.status]}</span>
        </div>
        <div className="h-1.75 overflow-hidden rounded-[10px] border border-portal-border bg-portal-bg">
          <div className={`h-full rounded-[10px] transition-[width] duration-600 ${PROGRESS_FILL[t.status] || ''}`} />
        </div>
      </div>

      <div className="mt-4.5 border-t border-portal-border pt-4">
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-portal-gray uppercase">
          <IconMessages size={13} /> Historial · {t.comments.length} {t.comments.length === 1 ? 'mensaje' : 'mensajes'}
        </div>
        {t.comments.length ? (
          t.comments.map((c, i) => <CommentItem key={i} c={c} />)
        ) : (
          <p className="text-xs text-portal-gray">Sin actualizaciones aún.</p>
        )}
      </div>

      {t.status !== 'cerrado' ? (
        <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-portal-text-sec uppercase">
            <IconMessageReply size={13} /> Tu respuesta
          </div>
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              setReplyError(false);
            }}
            placeholder="Escribe tu mensaje al equipo de soporte..."
            className={
              'w-full resize-none rounded-[10px] border-[1.5px] bg-slate-50 px-3.5 py-2.75 text-[13px] text-portal-text outline-none transition-all focus:border-portal-navy focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,46,107,0.12)] ' +
              (replyError ? 'border-portal-red' : 'border-portal-border')
            }
          />
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={submitReply}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-portal-navy to-portal-navy-mid px-5 py-2.25 text-xs font-bold text-white shadow-[0_3px_10px_rgba(26,46,107,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(26,46,107,0.42)] disabled:opacity-60"
            >
              <IconSend size={14} /> Enviar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-portal-green-light px-3.75 py-2.75 text-xs font-bold text-emerald-800">
          <IconCircleCheck size={16} /> Ticket cerrado — El problema fue resuelto
        </div>
      )}
    </div>
  );
}
