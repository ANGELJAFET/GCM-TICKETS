'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  IconUserCircle,
  IconTicket,
  IconMail,
  IconPhone,
  IconBuilding,
  IconMapPin,
  IconMap2,
  IconLogin,
  IconCalendar,
  IconCopy,
  IconLock,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconLoader2,
} from '@tabler/icons-react';
import { Modal, Tabs } from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { Usuario, UsuarioTicketSummary } from '@/lib/types';

const AVATAR_CLS: Record<number, string> = { 1: 'bg-linear-to-br from-slate-500 to-slate-400', 2: 'bg-linear-to-br from-blue-600 to-violet-600', 3: 'bg-linear-to-br from-emerald-600 to-green-500', 4: 'bg-linear-to-br from-red-600 to-orange-500' };
const ROL_CLS: Record<string, string> = { empleado: 'bg-admin-light text-admin-gray', tecnico: 'bg-admin-blue-light text-blue-700', admin: 'bg-admin-green-light text-emerald-800', superadmin: 'bg-admin-amber-light text-amber-800' };
const STATUS_LABEL: Record<string, string> = { abierto: 'Abierto', en_progreso: 'En progreso', cerrado: 'Cerrado' };
const STATUS_COLOR: Record<string, string> = { abierto: '#3b82f6', en_progreso: '#f59e0b', cerrado: '#10b981' };
const PRIO_COLOR: Record<string, string> = { 'Crítica': '#ef4444', Alta: '#f97316', Media: '#f59e0b', Baja: '#94a3b8' };

function initials(nombre: string, apellido: string | null) {
  const n = (nombre || '').trim();
  const a = (apellido || '').trim();
  if (!n) return '?';
  return (n[0] + (a ? a[0] : n[1] || '')).toUpperCase();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface UserDetailModalProps {
  open: boolean;
  usuario: Usuario | null;
  onClose: () => void;
  onOpenTicket: (ticketId: string) => void;
}

/** Fila de dato de perfil; no se renderiza si `value` es falsy (oculta campos vacíos en vez de mostrarlos en blanco). */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-admin-light py-2.5 last:border-b-0 dark:border-white/8">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-admin-gray">
        {icon} {label}
      </span>
      <span className="text-right text-[13px] font-medium break-all">{value}</span>
    </div>
  );
}

/** Formulario de cambio de contraseña de otro usuario; solo se monta cuando quien ve el modal es superadmin (ver `UserDetailModal`). */
function PasswordSection({ userId }: { userId: number }) {
  const { token } = useAdminAuth();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (pass.length < 6) {
      setMsg({ text: 'Mínimo 6 caracteres.', ok: false });
      return;
    }
    setSaving(true);
    try {
      await api(`/usuarios/${userId}/password`, { method: 'PATCH', token, body: { newPassword: pass } });
      setMsg({ text: 'Contraseña actualizada correctamente.', ok: true });
      setPass('');
    } catch {
      setMsg({ text: 'Error al cambiar contraseña.', ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-admin-border pt-4 dark:border-white/10">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase">
        <IconLock size={13} /> Contraseña
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Escribir nueva contraseña…"
            autoComplete="new-password"
            className="w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3.5 py-2.25 pr-9 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-admin-gray">
            {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-[10px] bg-emerald-600 px-4 py-2.25 text-[13px] font-bold text-white hover:opacity-85 disabled:opacity-60"
        >
          {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconDeviceFloppy size={15} />} Guardar
        </button>
      </div>
      {msg && <div className={`mt-1.5 text-[12px] ${msg.ok ? 'text-admin-green' : 'text-admin-red'}`}>{msg.text}</div>}
    </div>
  );
}

/** Pestaña "Tickets" del detalle de usuario: resumen por estado y listado clicable que navega a `/admin?ticket=ID` vía `onOpenTicket`. */
function TicketsTab({ userId, onOpenTicket }: { userId: number; onOpenTicket: (ticketId: string) => void }) {
  const { token } = useAdminAuth();
  const { data } = useSWR<{ nombre: string; tickets: UsuarioTicketSummary[] }>(token ? [`/usuarios/${userId}/tickets`, token] : null, ([url]: [string]) => api(url, { token }));

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 py-9 text-center text-admin-gray">
        <IconLoader2 size={24} className="animate-spin" />
        Cargando tickets…
      </div>
    );
  }

  if (!data.tickets.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-9 text-center text-admin-gray">
        <IconTicket size={32} className="opacity-30" />
        <span className="text-[13px]">{data.nombre} no tiene tickets registrados</span>
      </div>
    );
  }

  const total = data.tickets.length;
  const abiertos = data.tickets.filter((t) => t.status === 'abierto').length;
  const progreso = data.tickets.filter((t) => t.status === 'en_progreso').length;
  const cerrados = data.tickets.filter((t) => t.status === 'cerrado').length;

  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-admin-light px-2 py-2 dark:bg-admin-dark-alt">
          <div className="text-lg font-extrabold">{total}</div>
          <div className="text-[10px] text-admin-gray">Total</div>
        </div>
        <div className="rounded-lg bg-admin-light px-2 py-2 dark:bg-admin-dark-alt">
          <div className="text-lg font-extrabold text-blue-600">{abiertos}</div>
          <div className="text-[10px] text-admin-gray">Abiertos</div>
        </div>
        <div className="rounded-lg bg-admin-light px-2 py-2 dark:bg-admin-dark-alt">
          <div className="text-lg font-extrabold text-amber-600">{progreso}</div>
          <div className="text-[10px] text-admin-gray">En progreso</div>
        </div>
        <div className="rounded-lg bg-admin-light px-2 py-2 dark:bg-admin-dark-alt">
          <div className="text-lg font-extrabold text-emerald-600">{cerrados}</div>
          <div className="text-[10px] text-admin-gray">Cerrados</div>
        </div>
      </div>
      <div className="flex max-h-80 flex-col overflow-y-auto">
        {data.tickets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTicket(t.id)}
            title="Ver ticket"
            className="flex flex-col gap-1.25 border-b border-admin-light py-2.75 text-left last:border-b-0 hover:bg-admin-light dark:border-white/8 dark:hover:bg-admin-dark-alt"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-admin-blue">{t.id}</span>
              <span className="truncate text-[13px]">{t.titulo}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}>
                {STATUS_LABEL[t.status] || t.status}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${PRIO_COLOR[t.prioridad]}20`, color: PRIO_COLOR[t.prioridad] }}>
                {t.prioridad}
              </span>
              <span className="text-[11px] text-admin-gray">{fmtDate(t.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Modal de detalle de un usuario: pestaña "Perfil" (datos personales y,
 * si quien lo ve es superadmin, cambio de contraseña) y pestaña "Tickets"
 * (historial de tickets reportados por él).
 */
export function UserDetailModal({ open, usuario, onClose, onOpenTicket }: UserDetailModalProps) {
  const { isSuperAdmin } = useAdminAuth();
  const [tab, setTab] = useState<'perfil' | 'tickets'>('perfil');

  if (!usuario) return null;
  const u = usuario;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-md"
      title={
        <span className="flex items-center gap-2">
          <IconUserCircle size={17} /> {u.nombre} {u.apellido || ''}
        </span>
      }
    >
      <Tabs
        items={[
          { value: 'perfil', label: <span className="flex items-center gap-1.5"><IconUserCircle size={14} /> Perfil</span> },
          { value: 'tickets', label: <span className="flex items-center gap-1.5"><IconTicket size={14} /> Tickets</span> },
        ]}
        value={tab}
        onChange={setTab}
        activeClassName="text-admin-blue border-admin-blue"
        className="-mx-5 mb-4 px-5"
      />

      {tab === 'perfil' ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white ${AVATAR_CLS[u.nivel] || AVATAR_CLS[1]}`}>{initials(u.nombre, u.apellido)}</div>
            <div>
              <div className="text-base font-extrabold">
                {u.nombre} {u.apellido || ''}
              </div>
              <div className="font-mono text-xs text-admin-gray">@{u.username}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROL_CLS[u.rol] || ROL_CLS.empleado}`}>{u.rol || 'empleado'}</span>
                {u.activo ? (
                  <span className="rounded-full bg-admin-green-light px-2 py-0.5 text-[10px] font-bold text-admin-green">Activo</span>
                ) : (
                  <span className="rounded-full bg-admin-light px-2 py-0.5 text-[10px] font-bold text-admin-gray">Inactivo</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div
              onClick={() => navigator.clipboard.writeText(u.username)}
              title="Clic para copiar"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-2.5 hover:bg-admin-light dark:hover:bg-admin-dark-alt"
            >
              <span className="flex items-center gap-1.5 text-xs text-admin-gray">
                <IconUserCircle size={13} /> Usuario
              </span>
              <span className="flex items-center gap-1 text-[13px] font-medium">
                {u.username} <IconCopy size={12} className="opacity-50" />
              </span>
            </div>
            <InfoRow icon={<IconMail size={13} />} label="Correo" value={u.email} />
            <InfoRow icon={<IconPhone size={13} />} label="Teléfono" value={u.telefono} />
            <InfoRow icon={<IconBuilding size={13} />} label="Departamento" value={u.departamento} />
            <InfoRow icon={<IconMapPin size={13} />} label="Finca" value={u.finca} />
            <InfoRow icon={<IconMap2 size={13} />} label="Área" value={u.area} />
            <InfoRow icon={<IconLogin size={13} />} label="Último acceso" value={u.ultimo_login ? fmtDate(u.ultimo_login) : 'Nunca'} />
            <InfoRow icon={<IconCalendar size={13} />} label="Registrado" value={fmtDate(u.created_at)} />
          </div>

          {isSuperAdmin() && <PasswordSection userId={u.id} />}
        </div>
      ) : (
        <TicketsTab userId={u.id} onOpenTicket={onOpenTicket} />
      )}
    </Modal>
  );
}
