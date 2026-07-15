'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IconUsersGroup,
  IconAddressBook,
  IconHistory,
  IconPackage,
  IconUsers,
  IconMoon,
  IconSun,
  IconLogout,
} from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { toggleDarkMode, isDarkMode } from '@/lib/theme';
import { NotificationBell } from './NotificationBell';
import { AdminManagerModal } from './AdminManagerModal';

export function Header({ hasSlaAlert = false }: { hasSlaAlert?: boolean }) {
  const { user, hasPermiso, logout } = useAdminAuth();
  const [dark, setDark] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const showInventario = hasPermiso('inventario') || hasPermiso('prestamos');
  const showUsuarios = hasPermiso('usuarios');
  const showAuditoria = hasPermiso('bitacora');

  return (
    <div className="flex h-15 shrink-0 items-center justify-between border-b border-admin-blue/15 bg-linear-to-r from-admin-brand to-[#172035] px-6 text-white shadow-[0_2px_18px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3">
        <Image
          src="/assets/gcm.jpg"
          alt="GCM Grupo Milcien"
          width={38}
          height={38}
          className="h-9.5 w-9.5 shrink-0 rounded-full border-2 border-white/40 bg-white object-contain p-0.75 shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
        />
        <h1 className="text-lg font-bold tracking-tight">GCM Tickets</h1>
        <span className="rounded-full bg-linear-to-br from-admin-blue to-indigo-500 px-2.5 py-0.75 text-[10px] font-extrabold tracking-wide">
          {(user?.nombre || 'ADMIN').toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          title="Gestionar usuarios admin"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 transition-colors hover:bg-white/16"
        >
          <IconUsersGroup size={18} />
        </button>
        <AdminManagerModal open={managerOpen} onClose={() => setManagerOpen(false)} />

        <NotificationBell forceDot={hasSlaAlert} />

        {showUsuarios && (
          <Link
            href="/admin/usuarios"
            className="flex items-center gap-1.5 rounded-[10px] border border-white/13 bg-white/7 px-3.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
          >
            <IconAddressBook size={15} /> Usuarios
          </Link>
        )}
        {showAuditoria && (
          <Link
            href="/admin/auditoria"
            className="flex items-center gap-1.5 rounded-[10px] border border-white/13 bg-white/7 px-3.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
          >
            <IconHistory size={15} /> Bitácora
          </Link>
        )}
        {showInventario && (
          <Link
            href="/admin/inventario"
            className="flex items-center gap-1.5 rounded-[10px] border border-white/13 bg-white/7 px-3.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
          >
            <IconPackage size={15} /> Inventario
          </Link>
        )}
        <Link
          href="/portal"
          className="flex items-center gap-1.5 rounded-[10px] border border-white/13 bg-white/7 px-3.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
        >
          <IconUsers size={15} /> Portal empleados
        </Link>
        <button
          type="button"
          onClick={() => setDark(toggleDarkMode())}
          title="Modo oscuro / claro"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 transition-colors hover:bg-white/16"
        >
          {(dark || isDarkMode()) ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        <button
          type="button"
          onClick={logout}
          title="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 transition-colors hover:bg-white/16"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </div>
  );
}
