'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  IconX,
  IconInfoCircle,
  IconLock,
  IconHistory,
  IconPlayerPlay,
  IconCheck,
  IconRefresh,
  IconTrash,
  IconSend,
  IconUserCircle,
  IconHeadset,
  IconPhoto,
  IconVideo,
  IconZoomIn,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { Drawer, Tabs } from '@/components/ui';
import type { AdminUser, Ticket, TicketComment } from '@/lib/types';
import { uploadUrl } from '@/lib/api';
import { StatusBadge, PrioBadge, SlaBadge } from './badges';

const TEMPLATES = [
  { label: 'Acuse de recibo', text: 'Hemos recibido su solicitud y la estamos atendiendo. Le mantendremos informado del avance.' },
  { label: 'Solicitar más info', text: 'Para continuar con la atención, necesitamos información adicional. ¿Podría darnos más detalles sobre el problema?' },
  { label: 'En proceso', text: 'Su ticket está siendo atendido. Estimamos resolverlo en las próximas 24 horas.' },
  { label: 'Solución aplicada', text: 'Hemos aplicado una solución. Por favor verifique si el inconveniente fue resuelto y confírmenos.' },
  { label: 'Cierre', text: 'Damos por resuelto su ticket. Gracias por comunicarse con soporte técnico. Cualquier problema adicional, no dude en crear un nuevo ticket.' },
];

function isImage(path: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
}
function isVideo(path: string) {
  return /\.(mp4|mov|avi|webm|3gp)$/i.test(path);
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function CommentItem({ c }: { c: TicketComment }) {
  const isUser = c.rolNivel < 2;
  return (
    <div className={clsx('mb-2 rounded-[10px] px-3.5 py-2.5 text-xs leading-relaxed', isUser ? 'border-l-3 border-admin-blue bg-admin-blue-light dark:bg-admin-blue/15' : 'border border-black/5 bg-admin-light dark:border-white/10 dark:bg-admin-dark-alt')}>
      {isUser ? <IconUserCircle size={12} className="mr-1 inline align-[-1px] text-admin-blue" /> : <IconHeadset size={12} className="mr-1 inline align-[-1px] text-admin-gray" />}
      <strong>{c.user || '—'}</strong> ({c.ts}): {c.text}
    </div>
  );
}

interface DetailDrawerProps {
  ticket: Ticket | null;
  open: boolean;
  now: number;
  onClose: () => void;
  admins: AdminUser[];
  onReassign: (id: string, val: string) => Promise<void>;
  onChangeStatus: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (id: string, text: string) => Promise<void>;
  onAddNote: (id: string, text: string) => Promise<void>;
}

export function DetailDrawer({ ticket: t, open, now, onClose, admins, onReassign, onChangeStatus, onDelete, onAddComment, onAddNote }: DetailDrawerProps) {
  const [tab, setTab] = useState<'info' | 'notes' | 'history'>('info');
  const [commentText, setCommentText] = useState('');
  const [noteText, setNoteText] = useState('');

  if (!t) return <Drawer open={open} onClose={onClose}><div /></Drawer>;

  const userReplies = t.comments.filter((c) => c.rolNivel < 2).length;

  return (
    <Drawer open={open} onClose={onClose} className="flex flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-admin-blue/20 bg-linear-to-br from-admin-brand to-[#172035] px-4.5 py-4 text-white">
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 hover:bg-white/16">
          <IconX size={17} />
        </button>
        <h2 className="flex-1 text-[15px] leading-snug font-bold">
          {t.id} — {t.title.substring(0, 30)}
          {t.title.length > 30 ? '…' : ''}
        </h2>
        <StatusBadge status={t.status} />
      </div>

      <Tabs
        items={[
          { value: 'info', label: <span className="flex items-center gap-1.5"><IconInfoCircle size={14} /> Info</span> },
          { value: 'notes', label: <span className="flex items-center gap-1.5"><IconLock size={14} /> Notas internas</span> },
          { value: 'history', label: <span className="flex items-center gap-1.5"><IconHistory size={14} /> Historial</span> },
        ]}
        value={tab}
        onChange={setTab}
        activeClassName="text-admin-blue border-admin-blue bg-white dark:bg-admin-dark-surface"
        className="border-b-0 bg-admin-light dark:bg-admin-dark-alt"
      />

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'info' && (
          <>
            <section className="mb-5.5">
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Descripción</h3>
              <div className="rounded-xl border-l-3 border-admin-blue bg-admin-light px-4 py-3.5 text-[13px] leading-relaxed dark:bg-admin-dark-alt">{t.desc || 'Sin descripción.'}</div>
            </section>

            <section className="mb-5.5">
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Información</h3>
              <div className="flex items-center justify-between border-b border-admin-light py-2.25 text-[13px] dark:border-white/8">
                <span className="text-admin-text-sec">Estado</span>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center justify-between border-b border-admin-light py-2.25 text-[13px] dark:border-white/8">
                <span className="text-admin-text-sec">Prioridad</span>
                <PrioBadge prioridad={t.prioridad} />
              </div>
              <div className="flex items-center justify-between border-b border-admin-light py-2.25 text-[13px] dark:border-white/8">
                <span className="text-admin-text-sec">Categoría</span>
                <span className="font-semibold">{t.categoria}</span>
              </div>
              <div className="flex items-center justify-between border-b border-admin-light py-2.25 text-[13px] dark:border-white/8">
                <span className="text-admin-text-sec">Reportado por</span>
                <span className="font-semibold">{t.reporter || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2.25 text-[13px]">
                <span className="text-admin-text-sec">Fecha</span>
                <span className="font-semibold">{t.fecha}</span>
              </div>
              {t.status !== 'cerrado' && t.fechaTs && now > 0 && (now - t.fechaTs) / 3600000 >= 24 && (
                <div className="flex items-center justify-between border-t border-admin-light py-2.25 text-[13px] dark:border-white/8">
                  <span className="text-admin-text-sec">SLA</span>
                  <SlaBadge ticket={t} now={now} />
                </div>
              )}
            </section>

            <section className="mb-5.5">
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Asignar a</h3>
              <select
                value={t.asignado || 'Sin asignar'}
                onChange={(e) => onReassign(t.id, e.target.value)}
                className="w-full cursor-pointer rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3 py-2.25 text-[13px] outline-none focus:border-admin-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:border-white/10 dark:bg-admin-dark-bg dark:focus:bg-admin-dark-bg"
              >
                <option value="Sin asignar">Sin asignar</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </section>

            <section className="mb-5.5">
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Acciones</h3>
              <div className="flex flex-wrap gap-2">
                {t.status !== 'en_progreso' && t.status !== 'cerrado' && (
                  <button
                    type="button"
                    onClick={() => onChangeStatus(t.id, 'en_progreso')}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)] hover:-translate-y-0.5"
                  >
                    <IconPlayerPlay size={15} /> Tomar
                  </button>
                )}
                {t.status !== 'cerrado' && (
                  <button
                    type="button"
                    onClick={() => onChangeStatus(t.id, 'cerrado')}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-emerald-600 to-admin-green px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.32)] hover:-translate-y-0.5"
                  >
                    <IconCheck size={15} /> Cerrar
                  </button>
                )}
                {t.status === 'cerrado' && (
                  <button
                    type="button"
                    onClick={() => onChangeStatus(t.id, 'abierto')}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)] hover:-translate-y-0.5"
                  >
                    <IconRefresh size={15} /> Reabrir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Eliminar este ticket permanentemente?')) onDelete(t.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-red-600 to-admin-red px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(239,68,68,0.32)] hover:-translate-y-0.5"
                >
                  <IconTrash size={15} /> Eliminar
                </button>
              </div>
            </section>

            <section className="mb-5.5">
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Archivos adjuntos</h3>
              {t.attachments?.length ? (
                t.attachments.map((a, i) => {
                  if (isImage(a.path)) {
                    return (
                      <div key={i} className="mb-1.5 overflow-hidden rounded-xl border border-admin-border dark:border-white/10">
                        <a href={uploadUrl(a.path)} target="_blank" rel="noreferrer" className="group relative block cursor-zoom-in bg-admin-light dark:bg-admin-dark-alt">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={uploadUrl(a.path)} alt={a.name} className="block max-h-65 w-full object-contain transition-transform group-hover:scale-102" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <IconZoomIn size={28} />
                          </div>
                        </a>
                        <div className="flex items-center justify-between border-t border-admin-border bg-admin-light px-3 py-2 dark:border-white/10 dark:bg-admin-dark-alt">
                          <span className="flex items-center gap-1 text-[11px] font-semibold">
                            <IconPhoto size={12} /> {a.name}
                          </span>
                          <span className="text-[10px] text-admin-gray">
                            {fmtSize(a.size)} · {a.ts}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (isVideo(a.path)) {
                    return (
                      <div key={i} className="mb-1.5 overflow-hidden rounded-xl border border-admin-border dark:border-white/10">
                        <video src={uploadUrl(a.path)} controls playsInline preload="metadata" className="block max-h-70 w-full bg-black" />
                        <div className="flex items-center justify-between border-t border-admin-border bg-admin-light px-3 py-2 dark:border-white/10 dark:bg-admin-dark-alt">
                          <span className="flex items-center gap-1 text-[11px] font-semibold">
                            <IconVideo size={12} /> {a.name}
                          </span>
                          <span className="text-[10px] text-admin-gray">
                            {fmtSize(a.size)} · {a.ts}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="mb-1.5 flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-light px-3 py-2 text-xs dark:border-white/10 dark:bg-admin-dark-alt">
                      <IconFileTypePdf size={18} className="text-admin-blue" />
                      <a href={uploadUrl(a.path)} target="_blank" rel="noreferrer" className="flex-1 font-semibold text-admin-blue hover:underline">
                        {a.name}
                      </a>
                      <span className="text-[10px] text-admin-gray">{fmtSize(a.size)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-admin-gray">Sin archivos adjuntos.</p>
              )}
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">
                Historial de mensajes · {t.comments.length} ({userReplies} del usuario)
              </h3>
              {t.comments.length ? t.comments.map((c, i) => <CommentItem key={i} c={c} />) : <p className="mb-2.5 text-xs text-admin-gray">Sin mensajes aún.</p>}
              <select
                value=""
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  if (!isNaN(idx)) setCommentText(TEMPLATES[idx].text);
                }}
                className="mb-2 w-full cursor-pointer rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3 py-2 text-[13px] outline-none dark:border-white/10 dark:bg-admin-dark-bg"
              >
                <option value="">Plantilla de respuesta…</option>
                {TEMPLATES.map((tp, i) => (
                  <option key={i} value={i}>
                    {tp.label}
                  </option>
                ))}
              </select>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder="Escribir respuesta al usuario..."
                className="w-full resize-none rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3.5 py-2.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:border-white/10 dark:bg-admin-dark-bg dark:focus:bg-admin-dark-bg"
              />
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (!commentText.trim()) return;
                    await onAddComment(t.id, commentText.trim());
                    setCommentText('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)] hover:-translate-y-0.5"
                >
                  <IconSend size={15} /> Responder
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'notes' && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">
              Notas internas <span className="text-[10px] font-normal normal-case text-admin-gray">(solo el equipo de soporte puede ver esto)</span>
            </h3>
            {t.notes?.length ? (
              t.notes.map((n, i) => (
                <div key={i} className="mb-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed">
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-admin-gray">
                    <IconLock size={10} /> {n.user} · {n.ts}
                  </div>
                  {n.text}
                </div>
              ))
            ) : (
              <p className="mb-3 text-xs text-admin-gray">Sin notas internas.</p>
            )}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="Agregar nota interna (no visible al usuario)..."
              className="w-full resize-none rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3.5 py-2.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white dark:border-white/10 dark:bg-admin-dark-bg dark:focus:bg-admin-dark-bg"
            />
            <div className="mt-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (!noteText.trim()) return;
                  await onAddNote(t.id, noteText.trim());
                  setNoteText('');
                }}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-4 py-2.25 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.32)] hover:-translate-y-0.5"
              >
                <IconLock size={15} /> Guardar nota
              </button>
            </div>
          </section>
        )}

        {tab === 'history' && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">
              Historial de cambios · {t.history?.length || 0} eventos
            </h3>
            {t.history?.length ? (
              [...t.history].reverse().map((h, i) => (
                <div key={i} className="flex gap-2.5 border-b border-admin-light py-2 text-xs last:border-b-0 dark:border-white/8">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-admin-blue" />
                  <div>
                    <div>
                      <strong>{h.user}</strong> — {h.accion}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-admin-gray">{h.ts}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-admin-gray">Sin historial.</p>
            )}
          </section>
        )}
      </div>
    </Drawer>
  );
}
