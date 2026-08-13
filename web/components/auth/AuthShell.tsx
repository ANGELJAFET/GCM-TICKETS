'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { IconEye, IconEyeOff, IconLogin, IconLoader2, IconAlertCircle, IconUser, IconLock } from '@tabler/icons-react';

export interface AuthShellProps {
  /** Controla el color de acento del CTA, foco y detalles. */
  accent: 'admin' | 'portal';
  brandTitle: string;
  brandSubtitle: ReactNode;
  badge: { icon: ReactNode; text: string };
  formTitle: string;
  formSubtitle: string;
  /** Envía las credenciales. La lógica de red vive en el hook de cada pantalla. */
  onSubmit: (username: string, password: string) => Promise<void> | void;
  loading: boolean;
  error: string;
  /** Enlaces bajo el formulario (p. ej. "Solicitar acceso"). */
  footer?: ReactNode;
  submitLabel?: string;
  loadingLabel?: string;
}

/**
 * Estructura visual compartida por los dos logins (admin y portal): foto de
 * fondo, capa de realce, panel de marca navy translúcido a la izquierda y panel
 * de formulario translúcido a la derecha. Sólo parametriza acento, textos y
 * handlers; la lógica de autenticación la aporta cada pantalla vía `onSubmit`.
 */
export function AuthShell({
  accent,
  brandTitle,
  brandSubtitle,
  badge,
  formTitle,
  formSubtitle,
  onSubmit,
  loading,
  error,
  footer,
  submitLabel = 'Iniciar sesión',
  loadingLabel = 'Verificando…',
}: AuthShellProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const uid = useId();
  const userId = `${uid}-user`;
  const passId = `${uid}-pass`;
  const errorId = `${uid}-error`;

  const isPortal = accent === 'portal';
  const shownError = error || localError;

  // Autofocus en el campo Usuario al montar.
  useEffect(() => {
    userRef.current?.focus();
  }, []);

  // Tras un error de red, devolver el foco al campo de contraseña.
  useEffect(() => {
    if (error) passRef.current?.focus();
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (!username || !password) {
      setLocalError('Ingresa usuario y contraseña.');
      passRef.current?.focus();
      return;
    }
    await onSubmit(username.trim(), password);
  }

  // Acentos por variante. Se usan clases estáticas completas para que Tailwind
  // las detecte en compilación.
  // Ambos acentos comparten el navy de marca (#1a2e6b) para foco y CTA; sólo el
  // detalle rojo del admin los diferencia. Clases estáticas completas para que
  // Tailwind las detecte en compilación.
  // Paleta grafito/carbón oscuro con acento rojo GCM: contrasta fuerte con la
  // foto de fondo (verdes/turquesas) y mantiene el texto blanco muy legible.
  const accentFocusInput =
    'focus:border-[#e23b3b] focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(226,59,59,0.18)] focus-visible:outline-[#ef4444]';
  const accentButton =
    'bg-linear-to-br from-[#c81e2d] to-[#e23b3b] shadow-[0_10px_28px_-8px_rgba(204,34,34,0.55)] hover:shadow-[0_16px_36px_-8px_rgba(204,34,34,0.6)] active:shadow-[0_6px_16px_-8px_rgba(204,34,34,0.5)] focus-visible:outline-[#ef4444]';
  const accentBrandGradient = 'from-[#1a1b20]/90 via-[#202126]/90 to-[#141519]/90';
  const accentFocusVisible = 'focus-visible:outline-[#ef4444]';

  const inputBase =
    'w-full rounded-[10px] border-[1.5px] border-white/12 bg-white/[0.06] py-3 pr-3.5 pl-11 text-sm text-white outline-none transition-all placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';

  return (
    <div className="relative flex min-h-[100dvh] items-stretch justify-start overflow-y-auto overflow-x-hidden bg-[#0b1a2e]">
      {/* Foto de fondo con next/image, detrás de la capa de oscurecimiento. */}
      <Image
        src="/assets/login-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="pointer-events-none object-cover [filter:saturate(1.1)_contrast(1.05)_brightness(1.02)]"
      />
      {/* Degradado de separación junto al panel izquierdo. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent dark:from-black/50" />

      <main className="relative z-10 flex w-full max-w-[34rem] overflow-hidden shadow-[0_25px_80px_-15px_rgba(0,0,0,0.55)] max-[620px]:max-w-full max-[620px]:flex-col">
        {/* Panel izquierdo: marca. Velo navy ~/95 para contraste independiente de la foto. */}
        <div
          className={`relative flex w-[40%] shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-br ${accentBrandGradient} px-10 py-14 text-center backdrop-blur-md max-[620px]:w-full max-[620px]:px-7 max-[620px]:py-9`}
        >
          {!isPortal && (
            <div
              className="absolute top-0 bottom-0 left-0 w-1"
              style={{ backgroundImage: 'linear-gradient(180deg, transparent 0%, #cc2222 35%, #ef4444 65%, transparent 100%)' }}
            />
          )}
          <Image
            src="/assets/gcm.jpg"
            alt="GCM Grupo Milcien"
            width={92}
            height={92}
            className="relative z-1 mb-6 rounded-full border-[3px] border-white/18 bg-white object-contain p-2 shadow-[0_8px_36px_rgba(0,0,0,0.4),0_0_0_6px_rgba(255,255,255,0.05)] max-[620px]:mb-4 max-[620px]:h-18 max-[620px]:w-18"
          />
          <div className="relative z-1 mb-2 text-xl font-bold tracking-tight text-white max-[620px]:text-lg">{brandTitle}</div>
          <div className="relative z-1 text-xs leading-[1.7] text-white/75">{brandSubtitle}</div>
          <div
            className={
              isPortal
                ? 'relative z-1 mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] text-white/85'
                : 'relative z-1 mt-8 inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-600/25 px-3.5 py-1.5 text-[11px] text-red-100'
            }
          >
            <span aria-hidden>{badge.icon}</span> {badge.text}
          </div>
        </div>

        {/* Panel derecho: formulario. */}
        <div className="flex flex-1 flex-col justify-center bg-[#17181d]/80 px-11 py-14 backdrop-blur-md max-[620px]:px-7 max-[620px]:py-8">
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-white max-[620px]:text-xl">
            {formTitle}
          </h1>
          <p className="mb-8 text-sm text-slate-300">
            {formSubtitle}
          </p>

          <form onSubmit={handleSubmit} aria-busy={loading} noValidate className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor={userId} className="text-[11px] font-bold tracking-wide text-slate-300 uppercase">
                  Usuario
                </label>
                <div className="relative">
                  <IconUser
                    size={18}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 dark:text-admin-dark-text-sec"
                  />
                  <input
                    ref={userRef}
                    id={userId}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isPortal ? 'jlopez' : 'admin'}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    disabled={loading}
                    aria-invalid={!!shownError}
                    aria-describedby={shownError ? errorId : undefined}
                    className={`${inputBase} ${accentFocusInput}`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={passId} className="text-[11px] font-bold tracking-wide text-slate-300 uppercase">
                  Contraseña
                </label>
                <div className="relative">
                  <IconLock
                    size={18}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 dark:text-admin-dark-text-sec"
                  />
                  <input
                    ref={passRef}
                    id={passId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={!!shownError}
                    aria-describedby={shownError ? errorId : undefined}
                    className={`${inputBase} pr-11 ${accentFocusInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    disabled={loading}
                    className={`absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${accentFocusVisible}`}
                  >
                    {showPassword ? <IconEyeOff size={18} aria-hidden /> : <IconEye size={18} aria-hidden />}
                  </button>
                </div>
              </div>
            </div>

            {shownError && (
              <div
                id={errorId}
                role="alert"
                aria-live="assertive"
                className="flex items-center gap-1.5 rounded-[10px] border border-red-500/30 bg-red-500/15 px-3.5 py-2.5 text-xs font-semibold text-red-100"
              >
                <IconAlertCircle size={14} aria-hidden /> {shownError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              aria-busy={loading}
              className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl p-3.5 text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${accentButton}`}
            >
              {loading ? (
                <IconLoader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconLogin size={18} aria-hidden />
              )}
              {loading ? loadingLabel : submitLabel}
            </button>
          </form>

          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            Conexión en red interna
          </p>
        </div>
      </main>
    </div>
  );
}
