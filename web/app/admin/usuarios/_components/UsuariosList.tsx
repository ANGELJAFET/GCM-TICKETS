'use client';

import { useMemo, useState } from 'react';
import { IconAddressBook, IconSearch, IconUsersMinus, IconShieldCheck, IconUsers, IconEye, IconUserOff, IconUserCheck, IconTrash, IconMail, IconBuilding, IconLogin } from '@tabler/icons-react';
import { useConfirm } from '@/components/ui';
import type { Usuario } from '@/lib/types';

const ROL_CLS: Record<string, string> = { empleado: 'bg-admin-light text-admin-gray dark:bg-white/10 dark:text-admin-dark-text-sec', tecnico: 'bg-admin-blue-light text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', admin: 'bg-admin-green-light text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', superadmin: 'bg-admin-amber-light text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' };
const AVATAR_CLS: Record<number, string> = { 1: 'bg-linear-to-br from-slate-500 to-slate-400', 2: 'bg-linear-to-br from-blue-600 to-violet-600', 3: 'bg-linear-to-br from-emerald-600 to-green-500', 4: 'bg-linear-to-br from-red-600 to-orange-500' };

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

interface UsuariosListProps {
  usuarios: Usuario[];
  currentUsername: string;
  onView: (id: number) => void;
  onToggleActivo: (id: number, activo: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

/** Fila de un usuario en el listado, con acciones de ver detalle, activar/desactivar y eliminar (ocultas para la propia cuenta vía `isSelf`). */
function UsrRow({ u, isSelf, onView, onToggleActivo, onDelete }: { u: Usuario; isSelf: boolean; onView: (id: number) => void; onToggleActivo: (id: number, activo: boolean) => Promise<void>; onDelete: (id: number) => Promise<void> }) {
  const { confirm } = useConfirm();
  return (
    <div className={`flex flex-wrap items-center gap-3 border-b border-admin-light py-3 last:border-b-0 dark:border-white/8 ${u.activo ? '' : 'opacity-65'}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${AVATAR_CLS[u.nivel] || AVATAR_CLS[1]}`}>{initials(u.nombre, u.apellido)}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">
          {u.nombre} {u.apellido || ''} <span className="font-mono text-[11px] font-normal text-admin-gray">@{u.username}</span>
          {isSelf && <span className="ml-1 rounded-full bg-admin-blue-light px-1.75 py-0.5 text-[10px] font-bold text-admin-blue dark:bg-blue-500/15 dark:text-blue-300">Tú</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-admin-gray">
          {u.email && (
            <span className="flex items-center gap-0.75">
              <IconMail size={11} /> {u.email}
            </span>
          )}
          {u.departamento && (
            <span className="flex items-center gap-0.75">
              <IconBuilding size={11} /> {u.departamento}
            </span>
          )}
          <span className="flex items-center gap-0.75">
            <IconLogin size={11} /> {u.ultimo_login ? fmtDate(u.ultimo_login) : 'Nunca'}
          </span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROL_CLS[u.rol] || ROL_CLS.empleado}`}>{u.rol || 'empleado'}</span>
          {u.activo ? (
            <span className="flex items-center gap-0.5 rounded-full bg-admin-green-light px-2 py-0.5 text-[10px] font-bold text-admin-green dark:bg-emerald-500/15 dark:text-emerald-300">
              <IconUserCheck size={10} /> Activo
            </span>
          ) : (
            <span className="flex items-center gap-0.5 rounded-full bg-admin-light px-2 py-0.5 text-[10px] font-bold text-admin-gray dark:bg-white/10 dark:text-admin-dark-text-sec">
              <IconUserOff size={10} /> Inactivo
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={() => onView(u.id)} className="flex items-center gap-1 rounded-lg bg-admin-blue-light px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:opacity-85 dark:bg-blue-500/15 dark:text-blue-300">
          <IconEye size={12} /> Ver
        </button>
        {!isSelf && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: u.activo ? 'Desactivar usuario' : 'Activar usuario',
                message: `¿Deseas ${u.activo ? 'desactivar' : 'activar'} a ${u.nombre} ${u.apellido || ''}?`.trim(),
                confirmText: u.activo ? 'Desactivar' : 'Activar',
              });
              if (ok) onToggleActivo(u.id, !u.activo);
            }}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold hover:opacity-85 ${u.activo ? 'bg-admin-light text-admin-text-sec dark:bg-white/10 dark:text-admin-dark-text-sec' : 'bg-emerald-600 text-white'}`}
          >
            {u.activo ? <IconUserOff size={12} /> : <IconUserCheck size={12} />} {u.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
        {!isSelf && (
          <button
            type="button"
            onClick={async () => {
              const nombre = `${u.nombre} ${u.apellido || ''}`.trim();
              const ok = await confirm({
                title: 'Eliminar usuario',
                message: `¿Eliminar permanentemente a "${nombre}"?\n\nEsta acción no se puede deshacer. Los tickets asignados quedarán sin asignar.`,
                confirmText: 'Eliminar',
                danger: true,
              });
              if (ok) onDelete(u.id);
            }}
            className="flex items-center gap-1 rounded-lg bg-admin-red-light px-2.5 py-1.5 text-[11px] font-bold text-admin-red hover:bg-admin-red hover:text-white dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-admin-red dark:hover:text-white"
          >
            <IconTrash size={12} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Listado "Usuarios registrados": filtro de búsqueda en cliente y
 * agrupación en "Usuarios del sistema" (staff, `nivel >= 2`) vs "Empleados"
 * (`nivel < 2`).
 */
export function UsuariosList({ usuarios, currentUsername, onView, onToggleActivo, onDelete }: UsuariosListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => (u.nombre || '').toLowerCase().includes(q) || (u.apellido || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [usuarios, search]);

  const sysUsers = filtered.filter((u) => u.nivel >= 2);
  const empleados = filtered.filter((u) => u.nivel < 2);

  return (
    <div className="rounded-2xl border border-admin-border bg-white p-5 dark:border-white/10 dark:bg-admin-dark-surface">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <IconAddressBook size={16} /> Usuarios registrados
        </div>
        <div className="relative w-64 max-w-full">
          <IconSearch size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-admin-gray" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario o correo…"
            className="h-9 w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light pr-3.5 pl-8.5 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
          />
        </div>
      </div>

      {!filtered.length ? (
        <div className="flex flex-col items-center gap-2 py-9 text-center text-admin-gray">
          <IconUsersMinus size={28} />
          <p className="text-[13px]">No se encontraron usuarios</p>
        </div>
      ) : (
        <>
          {sysUsers.length > 0 && (
            <>
              <div className="mt-1 mb-1.5 flex items-center gap-1.5 border-t border-admin-border pt-3 text-[11px] font-bold text-admin-text-sec first:mt-0 first:border-t-0 first:pt-0">
                <IconShieldCheck size={13} /> Usuarios del sistema <span className="rounded-full bg-admin-light px-1.75 py-0.5 text-[10px] dark:bg-white/10">{sysUsers.length}</span>
              </div>
              {sysUsers.map((u) => (
                <UsrRow key={u.id} u={u} isSelf={u.username === currentUsername} onView={onView} onToggleActivo={onToggleActivo} onDelete={onDelete} />
              ))}
            </>
          )}
          {empleados.length > 0 && (
            <>
              <div className="mt-3 mb-1.5 flex items-center gap-1.5 border-t border-admin-border pt-3 text-[11px] font-bold text-admin-text-sec">
                <IconUsers size={13} /> Empleados <span className="rounded-full bg-admin-light px-1.75 py-0.5 text-[10px] dark:bg-white/10">{empleados.length}</span>
              </div>
              {empleados.map((u) => (
                <UsrRow key={u.id} u={u} isSelf={u.username === currentUsername} onView={onView} onToggleActivo={onToggleActivo} onDelete={onDelete} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
