'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { IconEye, IconEyeOff, IconLoader2, IconAlertCircle, IconArrowRight, IconBrandWhatsapp } from '@tabler/icons-react';

export interface AuthShellProps {
  /** Controla detalles por variante (admin/portal). */
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
  /** Si se define, muestra un botón flotante de WhatsApp (solo dígitos, formato wa.me). */
  whatsapp?: string;
}

/**
 * Estructura visual compartida por los dos logins (admin y portal): estilo
 * "transparente" (sin tarjeta) — logo y textos centrados, campos con línea
 * inferior y botón fantasma flotando sobre la foto de fondo, para que la
 * imagen resalte. Sólo parametriza textos y handlers; la lógica de
 * autenticación la aporta cada pantalla vía `onSubmit`.
 */
export function AuthShell({
  brandTitle,
  formTitle,
  formSubtitle,
  onSubmit,
  loading,
  error,
  footer,
  submitLabel = 'Iniciar sesión',
  loadingLabel = 'Verificando…',
  whatsapp,
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

  // Estilo "login transparente": campos con sólo línea inferior, fondo
  // transparente y texto blanco con sombra para legibilidad sobre la foto.
  // El foco de teclado engrosa la línea inferior en blanco (indicador visible).
  const inputBase =
    'w-full rounded-none border-0 border-b border-white/40 bg-transparent px-1 py-2.5 text-white outline-none transition-colors placeholder:text-white/55 focus:border-white focus-visible:border-white focus-visible:outline-none focus-visible:[box-shadow:0_2px_0_0_#ffffff] disabled:opacity-60 [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]';

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#0b1a2e] p-6">
      {/* Foto de fondo a pantalla completa, sin tarjeta que la tape. */}
      <Image
        src="/assets/login-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="pointer-events-none object-cover [filter:saturate(1.12)_contrast(1.06)_brightness(1.03)]"
      />
      {/* Viñeta focal suave: da contraste al texto sin oscurecer los bordes,
          así la foto se mantiene brillante alrededor del formulario. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(0,0,0,0.45),transparent_75%)]" />

      <main className="relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border border-white/15 bg-white/[0.07] px-8 py-10 text-center shadow-[0_25px_80px_-15px_rgba(0,0,0,0.55)] backdrop-blur-xl max-[620px]:px-6 max-[620px]:py-8">
        <Image
          src="/assets/gcm.jpg"
          alt="GCM Grupo Milcien"
          width={80}
          height={80}
          className="mb-5 h-20 w-20 rounded-full border border-white/30 bg-white/90 object-contain p-1.5 shadow-[0_6px_30px_rgba(0,0,0,0.5)]"
        />
        <div className="mb-2 text-xs font-semibold tracking-[0.35em] text-white/70 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          {brandTitle}
        </div>
        <h1 className="text-3xl font-light tracking-wide text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.6)] max-[620px]:text-2xl">
          {formTitle}
        </h1>
        <p className="mt-2 mb-9 text-sm text-white/70 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">{formSubtitle}</p>

        <form onSubmit={handleSubmit} aria-busy={loading} noValidate className="w-full space-y-7 text-left">
          <div className="space-y-6">
            <div>
              <label htmlFor={userId} className="sr-only">
                Usuario
              </label>
              <input
                ref={userRef}
                id={userId}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                disabled={loading}
                aria-invalid={!!shownError}
                aria-describedby={shownError ? errorId : undefined}
                className={inputBase}
              />
            </div>

            <div className="relative">
              <label htmlFor={passId} className="sr-only">
                Contraseña
              </label>
              <input
                ref={passRef}
                id={passId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                disabled={loading}
                aria-invalid={!!shownError}
                aria-describedby={shownError ? errorId : undefined}
                className={`${inputBase} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={loading}
                className="absolute top-1/2 right-0 -translate-y-1/2 p-1.5 text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
              >
                {showPassword ? <IconEyeOff size={18} aria-hidden /> : <IconEye size={18} aria-hidden />}
              </button>
            </div>
          </div>

          {shownError && (
            <div
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="flex items-center justify-center gap-1.5 rounded-md border border-red-300/30 bg-red-500/20 px-3 py-2 text-xs font-medium text-red-50 backdrop-blur-sm"
            >
              <IconAlertCircle size={14} aria-hidden /> {shownError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            aria-busy={loading}
            className="mx-auto flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white/5 px-8 py-3 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition hover:border-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <IconLoader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {loading ? loadingLabel : submitLabel}
            {!loading && <IconArrowRight size={18} aria-hidden />}
          </button>
        </form>

        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escríbenos por WhatsApp"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:bg-[#20b858] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <IconBrandWhatsapp size={20} aria-hidden />
            Soporte por WhatsApp
          </a>
        )}

        {footer && <div className="mt-8 text-center text-sm [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">{footer}</div>}
      </main>
    </div>
  );
}
