'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { IconUsersGroup, IconTrash, IconUserPlus, IconPackage, IconExchange, IconHistory, IconClipboardList, IconUsers } from '@tabler/icons-react';
import { Modal, FormField, Input, useToast, useConfirm } from '@/components/ui';
import { useAdminAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

const PERMISO_CHIPS = [
  { modulo: 'inventario', icon: IconPackage, label: 'Equipos' },
  { modulo: 'prestamos', icon: IconExchange, label: 'Préstamos' },
  { modulo: 'bitacora', icon: IconHistory, label: 'Bitácora' },
  { modulo: 'solicitudes', icon: IconClipboardList, label: 'Solicitudes' },
  { modulo: 'usuarios', icon: IconUsers, label: 'Usuarios' },
] as const;

const ROL_COLORS: Record<string, string> = { superadmin: '#7c3aed', admin: '#2563eb', tecnico: '#059669', empleado: '#64748b' };

interface AdminManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function AdminManagerModal({ open, onClose }: AdminManagerModalProps) {
  const { user, token, isSuperAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: admins, mutate } = useSWR<AdminUser[]>(open && token ? ['/admins', token] : null, ([url]: [string]) => api<AdminUser[]>(url, { token }));

  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const superAdmin = isSuperAdmin();
  const list = admins || [];
  const isOnly = list.length === 1;

  async function togglePermiso(id: number, modulo: string, next: boolean) {
    try {
      await api(`/usuarios/${id}/permisos`, { method: 'PATCH', token, body: { [modulo]: next } });
      showToast(next ? 'Acceso otorgado ✓' : 'Acceso revocado');
      await mutate();
    } catch {
      showToast('Error al actualizar el permiso');
    }
  }

  async function handleCreate() {
    if (!superAdmin) {
      showToast('Solo el administrador principal puede crear usuarios');
      return;
    }
    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '');
    if (!nombre.trim() || !cleanUser || !password) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      await api('/admins', { method: 'POST', token, body: { username: cleanUser, password, nombre: nombre.trim() } });
      setNombre('');
      setUsername('');
      setPassword('');
      await mutate();
      showToast(`Usuario @${cleanUser} creado correctamente ✓`);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'Ese nombre de usuario ya existe.' : 'Error al crear usuario.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(username: string) {
    if (!superAdmin) {
      showToast('Solo el administrador principal puede eliminar usuarios');
      return;
    }
    const ok = await confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar al usuario @${username}?\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admins/${username}`, { method: 'DELETE', token });
      await mutate();
      showToast(`Usuario @${username} eliminado ✓`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'No se pudo eliminar el usuario');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <IconUsersGroup size={17} /> Usuarios administradores
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            Cerrar
          </button>
          {superAdmin && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)] disabled:opacity-60"
            >
              <IconUserPlus size={15} /> Crear usuario
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Usuarios existentes</div>
          {!list.length ? (
            <p className="text-[13px] text-admin-gray">Sin usuarios.</p>
          ) : (
            list.map((a) => {
              const isMe = a.username === user?.username;
              const initials = a.nombre.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
              const canDelete = superAdmin && !isMe && !isOnly;
              const rolColor = ROL_COLORS[a.rol] || '#64748b';
              return (
                <div key={a.id} className="mb-2">
                  <div className="flex items-center gap-3 rounded-[10px] border border-admin-border bg-admin-light px-3.5 py-2.5 transition-shadow hover:shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-alt">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold text-white ${isMe ? 'bg-linear-to-br from-emerald-600 to-admin-green' : 'bg-linear-to-br from-admin-blue-dark to-indigo-500'}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold">{a.nombre}</div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-admin-text-sec">
                        @{a.username}
                        <span className="rounded-full px-1.75 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: `${rolColor}22`, color: rolColor }}>
                          {a.rol}
                        </span>
                      </div>
                    </div>
                    {isMe && <span className="rounded-full bg-admin-green-light px-2 py-0.5 text-[10px] font-bold text-admin-green">Tú</span>}
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => handleDelete(a.username)}
                      title={isMe ? 'No puedes eliminarte a ti mismo' : !superAdmin ? 'Solo el administrador principal puede eliminar usuarios' : isOnly ? 'Debe haber al menos un administrador' : 'Eliminar usuario'}
                      className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-admin-red-light text-admin-red transition-colors hover:bg-admin-red hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                  {superAdmin && a.nivel < 4 && (
                    <div className="mt-1.5 ml-12 flex flex-wrap gap-1.5">
                      {PERMISO_CHIPS.map(({ modulo, icon: Icon, label }) => {
                        const activo = !!a[`acceso_${modulo}` as keyof AdminUser];
                        return (
                          <button
                            key={modulo}
                            type="button"
                            onClick={() => togglePermiso(a.id, modulo, !activo)}
                            title={`${activo ? 'Quitar' : 'Otorgar'} acceso a ${label.toLowerCase()}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold ${activo ? 'bg-emerald-600 text-white' : 'bg-admin-light text-admin-text-sec dark:bg-admin-dark-alt'}`}
                          >
                            <Icon size={12} /> {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {superAdmin && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">Crear nuevo usuario</div>
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nombre completo" required>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Carlos Martínez" />
                </FormField>
                <FormField label="Usuario" required>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ej: carlos" autoComplete="off" />
                </FormField>
              </div>
              <FormField label="Contraseña" required>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              </FormField>
              {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
