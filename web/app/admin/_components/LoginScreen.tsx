'use client';

import { useState } from 'react';
import Image from 'next/image';
import { IconLogin, IconLoader2, IconShieldLock, IconLock, IconAlertCircle } from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';

/**
 * Pantalla de login del panel admin (mostrada por `admin/page.tsx` cuando no
 * hay sesión activa). Envía las credenciales vía {@link useAdminAuth}, que
 * llama a `POST /api/auth/login` con `portal: 'admin'`.
 */
export function LoginScreen() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Usuario o contraseña incorrectos');
      setPassword('');
    }
  }

  return (
    <div className="relative flex min-h-screen items-stretch justify-start overflow-hidden bg-[#0b1a2e] bg-[url('/assets/login-bg.jpg')] bg-cover bg-center bg-no-repeat">
      {/* Degradado suave hacia la derecha: da cohesión con el panel izquierdo
          sin oscurecer la foto (más marcado en modo oscuro). */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent dark:from-black/55" />

      <div className="relative z-10 flex w-full max-w-[54rem] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] max-[620px]:flex-col">
        <div className="relative flex w-[38%] shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#0b1838] via-[#162660] to-admin-brand2 px-9 py-13 text-center max-[620px]:w-auto max-[620px]:px-7 max-[620px]:py-9">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-linear-to-b from-transparent via-[#cc2222] to-transparent" style={{ backgroundImage: 'linear-gradient(180deg, transparent 0%, #cc2222 35%, #ef4444 65%, transparent 100%)' }} />
          <Image
            src="/assets/gcm.jpg"
            alt="GCM Grupo Milcien"
            width={92}
            height={92}
            className="relative z-1 mb-5.5 rounded-full border-[3px] border-white/18 bg-white object-contain p-2 shadow-[0_8px_36px_rgba(0,0,0,0.4),0_0_0_6px_rgba(255,255,255,0.05)] max-[620px]:mb-3.5 max-[620px]:h-18 max-[620px]:w-18"
          />
          <div className="relative z-1 mb-2 text-[23px] font-extrabold tracking-tight text-white max-[620px]:text-[19px]">GCM Tickets</div>
          <div className="relative z-1 text-xs leading-[1.7] text-white/50">
            Panel Administrativo
            <br />
            Grupo Milcien S.A. de C.V.
          </div>
          <div className="relative z-1 mt-7 inline-flex items-center gap-1.5 rounded-full border border-red-400/35 bg-red-600/18 px-3.5 py-1.5 text-[11px] text-red-200/90">
            <IconShieldLock size={14} /> Acceso restringido
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center bg-white/95 px-11 py-13 backdrop-blur-md max-[620px]:px-7 max-[620px]:py-8 dark:bg-admin-dark-surface/90">
          <div className="mb-1.25 text-[27px] font-extrabold tracking-tight text-admin-text max-[620px]:text-[22px] dark:text-admin-dark-text">
            Iniciar sesión
          </div>
          <div className="mb-7 text-[13px] text-admin-text-sec dark:text-admin-dark-text-sec">Solo personal de TI autorizado</div>

          <div className="mb-3.5 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wide text-admin-text-sec uppercase dark:text-admin-dark-text-sec">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === 'Enter') document.getElementById('adminLoginPass')?.focus();
              }}
              className="rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-3.25 text-sm outline-none focus:border-admin-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] dark:border-white/12 dark:bg-admin-dark-bg dark:text-admin-dark-text dark:focus:bg-admin-dark-bg"
            />
          </div>
          <div className="mb-3.5 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wide text-admin-text-sec uppercase dark:text-admin-dark-text-sec">Contraseña</label>
            <input
              id="adminLoginPass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              className="rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-3.25 text-sm outline-none focus:border-admin-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] dark:border-white/12 dark:bg-admin-dark-bg dark:text-admin-dark-text dark:focus:bg-admin-dark-bg"
            />
          </div>

          {error && (
            <div className="mb-1 flex items-center gap-1.5 rounded-[10px] border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">
              <IconAlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-1.75 rounded-xl bg-linear-to-br from-admin-blue-dark to-admin-blue p-3.5 text-[15px] font-bold text-white shadow-[0_4px_18px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(59,130,246,0.5)] disabled:opacity-70"
          >
            {loading ? <IconLoader2 size={18} className="animate-spin" /> : <IconLogin size={18} />}
            {loading ? 'Verificando…' : 'Ingresar al sistema'}
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <IconLock size={13} /> Sesión cifrada y protegida
          </p>
        </div>
      </div>
    </div>
  );
}
