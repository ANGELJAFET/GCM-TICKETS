'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IconUserPlus,
  IconTicket,
  IconHeadset,
  IconClock,
  IconShieldCheck,
  IconAlertCircle,
  IconCircleCheck,
  IconSend,
  IconLoader2,
  IconArrowLeft,
} from '@tabler/icons-react';
import { api, ApiError } from '@/lib/api';
import '../portal/portal.css';

const FINCAS = [
  'FINCA CORML',
  'FINCA EMAR',
  'FINCA NOVAHONDURAS 7',
  'FINCA LA ESPERANZA',
  'FINCA CORML 1',
  'FINCA CORML 2',
  'FINCA CADEMA',
  'FINCA EL CONCHAL',
  'No aplica',
];

const inputClass =
  'rounded-[10px] border-[1.5px] border-slate-200 bg-slate-50 px-3.25 py-2.5 text-[13px] text-slate-900 outline-none transition-colors focus:border-portal-navy focus:bg-white';
const labelClass = 'text-[11px] font-bold tracking-wide text-slate-700 uppercase';

/**
 * Página `/registro`: formulario de solicitud de acceso de empleados
 * (`POST /api/auth/register`). No crea la cuenta directamente — queda
 * pendiente hasta que un administrador la aprueba desde `/admin/usuarios`.
 * `finca` es una de las fincas fijas de la empresa (o `'No aplica'`); el
 * resto de campos de ubicación (`departamento`, `area`) son texto libre.
 */
export default function RegistroPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) || '').trim();

    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          username: get('username'),
          email: get('email'),
          password,
          nombre: get('nombre'),
          apellido: get('apellido') || undefined,
          telefono: get('telefono') || undefined,
          departamento: get('departamento') || undefined,
          finca: get('finca'),
          area: get('area') || undefined,
          anydesk: get('anydesk'),
          mensaje: get('mensaje') || undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a1628] px-3 py-7">
      <div className="ident-orb ident-orb-1" />
      <div className="ident-orb ident-orb-2" />
      <div className="ident-orb ident-orb-3" />
      <div className="relative z-1 flex w-[900px] max-w-full overflow-hidden rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)] max-[700px]:flex-col">
        {/* Panel izquierdo: marca */}
        <div className="relative flex w-[38%] shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#0b1838] via-[#162660] to-portal-navy-mid px-9 py-13 text-center max-[700px]:w-full max-[700px]:px-7 max-[700px]:py-9">
          <Image
            src="/assets/gcm.jpg"
            alt="GCM Grupo Milcien"
            width={88}
            height={88}
            className="relative z-1 mb-4.5 rounded-full border-[3px] border-white/18 bg-white object-contain p-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          />
          <div className="relative z-1 mb-1.5 text-[21px] font-extrabold tracking-tight text-white max-[700px]:text-lg">GCM Tickets</div>
          <div className="relative z-1 mb-5 text-xs leading-relaxed text-white/60">
            Portal de Soporte Técnico
            <br />
            Grupo Milcien S.A. de C.V.
          </div>
          <div className="relative z-1 mb-7 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/18 px-3.5 py-1.25 text-[11px] font-bold text-emerald-300">
            <IconUserPlus size={14} /> Solicitud de acceso
          </div>
          <div className="relative z-1 flex w-full flex-col gap-2.5 text-left max-[700px]:hidden">
            <div className="flex items-center gap-2.5 text-xs text-white/72">
              <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-emerald-300">
                <IconTicket size={12} />
              </span>
              Abre y rastrea tus tickets
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/72">
              <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-emerald-300">
                <IconHeadset size={12} />
              </span>
              Soporte técnico directo
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/72">
              <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-emerald-300">
                <IconClock size={12} />
              </span>
              Seguimiento en tiempo real
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white/72">
              <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-emerald-300">
                <IconShieldCheck size={12} />
              </span>
              Sistema interno corporativo
            </div>
          </div>
        </div>

        {/* Panel derecho: formulario */}
        <div className="flex max-h-[90vh] flex-1 flex-col overflow-y-auto bg-white px-11 py-10 max-[700px]:max-h-none max-[700px]:overflow-visible max-[700px]:px-6 max-[700px]:py-7">
          {!success ? (
            <>
              <div className="mb-1 text-[22px] font-extrabold tracking-tight text-slate-900">Crear cuenta</div>
              <div className="mb-6.5 text-[13px] text-slate-500">Completa el formulario y un administrador aprobará tu acceso</div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
                  <IconAlertCircle size={16} /> <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="mb-3.5 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Nombre *</label>
                    <input name="nombre" required placeholder="Juan" className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Apellido</label>
                    <input name="apellido" placeholder="López" className={inputClass} />
                  </div>
                </div>

                <div className="mb-3.5 flex flex-col gap-1.25">
                  <label className={labelClass}>Usuario (para iniciar sesión) *</label>
                  <input
                    name="username"
                    required
                    placeholder="jlopez"
                    autoComplete="username"
                    pattern="[a-zA-Z0-9_\-]+"
                    title="Solo letras, números, _ y -"
                    className={inputClass}
                  />
                </div>

                <div className="mb-3.5 flex flex-col gap-1.25">
                  <label className={labelClass}>Correo electrónico *</label>
                  <input type="email" name="email" required placeholder="correo empresarial" className={inputClass} />
                </div>

                <div className="mb-3.5 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Teléfono</label>
                    <input type="tel" name="telefono" placeholder="+504 9999-9999" className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Departamento</label>
                    <input name="departamento" placeholder="Ej: Contabilidad" className={inputClass} />
                  </div>
                </div>

                <div className="mb-3.5 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Finca *</label>
                    <select name="finca" required defaultValue="" className={inputClass}>
                      <option value="" disabled>
                        Selecciona una opción
                      </option>
                      {FINCAS.map((f) => (
                        <option key={f} value={f}>
                          {f === 'No aplica' ? 'No aplica (no soy de finca)' : f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Área</label>
                    <input name="area" placeholder="Ej: Producción" className={inputClass} />
                  </div>
                </div>

                <div className="mb-3.5 flex flex-col gap-1.25">
                  <label className={labelClass}>ID de AnyDesk *</label>
                  <input
                    name="anydesk"
                    required
                    inputMode="numeric"
                    placeholder="Ej: 123 456 789"
                    className={inputClass}
                  />
                  <span className="text-[11px] text-slate-500">
                    Necesario para brindarte soporte remoto. Ábrelo en AnyDesk: es el número que aparece en “Este puesto de trabajo”.
                  </span>
                </div>

                <div className="mb-3.5 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Contraseña *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1.25">
                    <label className={labelClass}>Confirmar contraseña *</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mb-1 flex flex-col gap-1.25">
                  <label className={labelClass}>Motivo de acceso (opcional)</label>
                  <textarea name="mensaje" placeholder="Explica brevemente para qué necesitas acceso al sistema..." className={`${inputClass} min-h-18 resize-y`} />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3.5 flex items-center justify-center gap-2 rounded-xl bg-linear-to-br from-portal-navy-dark to-portal-navy p-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(26,46,107,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(26,46,107,0.45)] disabled:translate-y-0 disabled:bg-slate-400 disabled:shadow-none"
                >
                  {submitting ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />}
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </form>

              <p className="mt-5 text-center text-[13px] text-slate-500">
                ¿Ya tienes cuenta?{' '}
                <Link href="/portal" className="font-bold text-portal-navy hover:underline">
                  Inicia sesión aquí
                </Link>
              </p>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-5 text-center">
              <div className="flex h-18 w-18 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-600">
                <IconCircleCheck size={36} />
              </div>
              <h2 className="text-xl font-extrabold text-emerald-800">¡Solicitud enviada!</h2>
              <p className="max-w-80 text-[13px] leading-relaxed text-slate-600">
                Tu solicitud fue recibida correctamente.
                <br />
                Un administrador la revisará y aprobará tu acceso pronto.
              </p>
              <Link href="/portal" className="flex items-center gap-1.5 text-[13px] font-bold text-portal-navy hover:underline">
                <IconArrowLeft size={14} /> Volver al portal
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
