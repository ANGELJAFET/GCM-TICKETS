'use client';

import { useState } from 'react';
import Image from 'next/image';
import { IconMoon, IconSun, IconLogout, IconUserCircle } from '@tabler/icons-react';
import { toggleDarkMode, isDarkMode } from '@/lib/theme';
import { usePortalAuth } from '@/lib/auth';

/** Barra superior del portal de empleados: marca, toggle de tema, cierre de sesión y nombre del usuario autenticado. */
export function Header() {
  const { user, logout } = usePortalAuth();
  const [dark, setDark] = useState(false);

  return (
    <header className="sticky top-0 z-50 flex h-17 items-center justify-between border-b border-white/10 bg-linear-to-br from-portal-navy to-portal-navy-mid px-7 text-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <Image
          src="/assets/gcm.jpg"
          alt="GCM Grupo Milcien"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full border-2 border-white/45 bg-white object-contain p-1 shadow-[0_2px_12px_rgba(0,0,0,0.22)]"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-extrabold tracking-tight">GCM Tickets</span>
          <span className="text-[10px] font-semibold tracking-wide text-white/65 uppercase max-[768px]:hidden">
            Grupo Milcien S.A. de C.V. — Soporte Técnico
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setDark(toggleDarkMode())}
          title="Modo oscuro / claro"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/22 bg-white/15 transition-colors hover:bg-white/28"
        >
          {(dark || isDarkMode()) ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        <button
          type="button"
          onClick={logout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="flex h-9.5 w-9.5 items-center justify-center rounded-[10px] border border-white/20 bg-white/12 transition-colors hover:border-red-400/40 hover:bg-red-500/22"
        >
          <IconLogout size={18} />
        </button>
        <div className="flex items-center gap-2 rounded-full border-[1.5px] border-white/25 bg-white/15 px-4 py-1.75 text-[13px] font-semibold">
          <IconUserCircle size={18} className="text-white/80" />
          <span className="max-[480px]:max-w-17.5 max-[480px]:truncate">{user?.nombre || '—'}</span>
        </div>
      </div>
    </header>
  );
}
