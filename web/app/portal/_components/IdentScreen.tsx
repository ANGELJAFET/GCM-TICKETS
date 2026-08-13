'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconLogin, IconLoader2, IconShieldCheck } from '@tabler/icons-react';
import { usePortalAuth } from '@/lib/auth';

/**
 * Pantalla de login del portal de empleados. Envía las credenciales vía
 * {@link usePortalAuth}, que llama a `POST /api/auth/login` con
 * `portal: 'empleado'`; enlaza a `/registro` para quien aún no tiene cuenta.
 */
export function IdentScreen() {
  const { login } = usePortalAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!username || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Error al iniciar sesión.');
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-start overflow-hidden bg-[#0b1a2e]">
      {/* Foto de fondo en capa propia con un ligero realce (más viva, con más
          saturación y contraste) para que resalte. */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/assets/login-bg.jpg')] bg-cover bg-center bg-no-repeat [filter:saturate(1.22)_contrast(1.1)_brightness(1.04)]" />
      {/* Sombra/degradado solo junto al panel izquierdo: separa el panel de la
          foto y ayuda a que su texto se note, sin oscurecer el resto de la imagen. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-transparent dark:from-black/45" />

      <div className="relative z-10 flex w-full max-w-[33rem] overflow-hidden shadow-[0_0_70px_rgba(0,0,0,0.65)] max-[620px]:flex-col">
        {/* Panel izquierdo: marca */}
        <div className="relative flex w-[38%] shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#0b1838]/90 via-[#162660]/88 to-portal-navy-mid/88 px-9 py-13 text-center backdrop-blur-xl max-[620px]:w-auto max-[620px]:px-7 max-[620px]:py-9">
          <Image
            src="/assets/gcm.jpg"
            alt="GCM Grupo Milcien"
            width={92}
            height={92}
            className="relative z-1 mb-5.5 rounded-full border-[3px] border-white/18 bg-white object-contain p-2 shadow-[0_8px_36px_rgba(0,0,0,0.4),0_0_0_6px_rgba(255,255,255,0.05)] max-[620px]:mb-3.5 max-[620px]:h-18 max-[620px]:w-18"
          />
          <div className="relative z-1 mb-2 text-[23px] font-extrabold tracking-tight text-white max-[620px]:text-[19px]">GCM Tickets</div>
          <div className="relative z-1 text-xs leading-[1.7] text-white/50">
            Portal de Soporte Técnico
            <br />
            Grupo Milcien S.A. de C.V.
          </div>
          <div className="relative z-1 mt-7.5 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/7 px-3.5 py-1.5 text-[11px] text-white/55">
            <IconShieldCheck size={14} /> Sistema interno corporativo
          </div>
        </div>

        {/* Panel derecho: formulario */}
        <div className="flex flex-1 flex-col justify-center bg-white/85 px-11 py-13 backdrop-blur-xl max-[620px]:px-7 max-[620px]:py-8 dark:bg-admin-dark-surface/80">
          <div className="mb-1 text-[27px] font-extrabold tracking-tight text-portal-navy max-[620px]:text-[22px] dark:text-admin-dark-text">
            Bienvenido
          </div>
          <div className="mb-7.5 text-[13px] text-portal-text-sec dark:text-admin-dark-text-sec">Ingresa tus credenciales para continuar</div>

          <div className="mb-4 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wide text-portal-text-sec uppercase dark:text-admin-dark-text-sec">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jlopez"
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === 'Enter') document.getElementById('loginPassword')?.focus();
              }}
              className="rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-3.25 text-sm text-portal-text outline-none transition-all focus:border-portal-navy focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,46,107,0.1)] dark:border-white/12 dark:bg-admin-dark-bg dark:text-admin-dark-text dark:focus:bg-admin-dark-bg"
            />
          </div>
          <div className="mb-4 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wide text-portal-text-sec uppercase dark:text-admin-dark-text-sec">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              className="rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-3.25 text-sm text-portal-text outline-none transition-all focus:border-portal-navy focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,46,107,0.1)] dark:border-white/12 dark:bg-admin-dark-bg dark:text-admin-dark-text dark:focus:bg-admin-dark-bg"
            />
          </div>

          {error && (
            <div className="mb-1 rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-portal-navy-dark to-portal-navy-mid p-3.5 text-[15px] font-bold text-white shadow-[0_4px_18px_rgba(26,46,107,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(26,46,107,0.5)] disabled:opacity-70"
          >
            {loading ? <IconLoader2 size={18} className="animate-spin" /> : <IconLogin size={18} />}
            {loading ? 'Verificando…' : 'Iniciar sesión'}
          </button>

          <p className="mt-4.5 text-center text-[13px] text-portal-text-sec dark:text-admin-dark-text-sec">
            ¿Sin cuenta?{' '}
            <Link href="/registro" className="font-semibold text-portal-navy hover:underline dark:text-blue-300">
              Solicitar acceso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
