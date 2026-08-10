'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { IconMoon, IconSun, IconLogout, IconChevronDown } from '@tabler/icons-react';
import { toggleDarkMode, isDarkMode } from '@/lib/theme';
import { usePortalAuth } from '@/lib/auth';
import { NotificationBell } from './NotificationBell';

/** Iniciales (máx. 2 letras) a partir del nombre completo del usuario, para el avatar del menú de cuenta. */
function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * Menú desplegable de cuenta: avatar con iniciales que, al hacer clic,
 * muestra el nombre del usuario, el toggle de tema y "Cerrar sesión".
 * Se cierra al hacer clic fuera, igual que `NotificationBell` en el panel admin.
 */
function AccountMenu() {
  const { user, logout } = usePortalAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const nombre = user?.nombre || '—';
  const dm = dark || isDarkMode();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Cuenta"
        className="flex items-center gap-2 rounded-full border-[1.5px] border-white/25 bg-white/15 py-1.25 pr-2.5 pl-1.25 transition-colors hover:bg-white/22"
      >
        <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-white/25 text-[12px] font-bold text-white">
          {initials(nombre)}
        </span>
        <span className="max-w-30 truncate text-[13px] font-semibold max-[480px]:hidden">{nombre}</span>
        <IconChevronDown size={14} className={`text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+10px)] right-0 z-[9999] w-56 overflow-hidden rounded-2xl border border-black/[0.07] bg-white text-portal-text shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text">
          <div className="border-b border-black/[0.07] px-4 py-3 dark:border-white/10">
            <div className="truncate text-sm font-bold">{nombre}</div>
            <div className="text-[11px] text-portal-text-sec dark:text-admin-dark-text-sec">@{user?.username || '—'}</div>
          </div>
          <button
            type="button"
            onClick={() => setDark(toggleDarkMode())}
            className="flex w-full items-center gap-2.5 px-4 py-2.75 text-left text-[13px] font-medium hover:bg-portal-bg dark:hover:bg-admin-dark-alt"
          >
            {dm ? <IconSun size={16} /> : <IconMoon size={16} />}
            {dm ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 border-t border-black/[0.07] px-4 py-2.75 text-left text-[13px] font-medium text-portal-red hover:bg-red-50 dark:border-white/10 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <IconLogout size={16} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/** Barra superior del portal de empleados: marca y menú de cuenta (avatar, tema y cierre de sesión). */
export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-17 items-center justify-between border-b border-white/10 bg-linear-to-br from-portal-navy to-portal-navy-mid px-7 text-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
      <div className="relative z-10 flex items-center gap-3">
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
      <div className="relative z-10 flex items-center gap-2.5">
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}
