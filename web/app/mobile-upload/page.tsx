'use client';

import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

/** Duración máxima permitida para un video de evidencia, validada en cliente antes de enviarlo. */
const MAX_VIDEO_SECONDS = 15;

/** Pantalla activa del flujo de subida móvil: selección de archivo, envío en curso, éxito o sesión expirada. */
type PanelId = 'select' | 'sending' | 'ok' | 'err';

/**
 * Página `/mobile-upload?session=<token>&type=<inventario?>`: el destino al
 * que apunta el QR generado por `QRModal`/`QRPhotoModal`. Se abre en el
 * celular sin necesidad de iniciar sesión — el `session` de la URL identifica
 * la sesión temporal a la que se sube el archivo (ver
 * `api/src/mobileSessions.ts` y `api/src/routes/mobileUpload.ts`).
 * `type=inventario` ajusta el texto/opciones mostradas (solo foto, sin
 * video) para el flujo de foto de equipo; `type=prestamo` es igual pero
 * multi-foto (permite tomar varias fotos del estado del equipo en la misma
 * sesión); cualquier otro valor asume el flujo de evidencia de ticket
 * (foto o video corto).
 */
function MobileUploadInner() {
  const params = useSearchParams();
  const session = params.get('session');
  const type = params.get('type');
  const isPrestamo = type === 'prestamo';
  // Ambos flujos de equipo (inventario y préstamo) son solo-foto, sin video.
  const isInventario = type === 'inventario' || isPrestamo;
  const [panel, setPanel] = useState<PanelId>(session ? 'select' : 'err');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<'photo' | 'video' | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [sendDisabled, setSendDisabled] = useState(false);
  // En el flujo multi-foto (préstamo) se lleva la cuenta de cuántas ya se subieron.
  const [uploadedCount, setUploadedCount] = useState(0);
  // El usuario presionó "Listo, terminé" en el flujo multi-foto → pantalla de cierre.
  const [finished, setFinished] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setKind(null);
    setDurationSec(null);
    setError('');
    // Rehabilita el botón de envío: tras enviar una foto queda deshabilitado,
    // y al preparar la siguiente (flujo multi) hay que volver a permitirlo.
    setSendDisabled(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  function onFileChosen(input: HTMLInputElement, type: 'photo' | 'video') {
    try {
      const f = input.files?.[0];
      if (!f) {
        setError('No se detectó ningún archivo seleccionado. Intenta de nuevo.');
        return;
      }
      setError('');

      if (type === 'video') {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
          URL.revokeObjectURL(vid.src);
          if (vid.duration > MAX_VIDEO_SECONDS) {
            setError(`El video dura ${Math.round(vid.duration)}s. El máximo permitido es ${MAX_VIDEO_SECONDS} segundos. Graba uno más corto.`);
            reset();
            return;
          }
          setChosen(f, 'video', Math.round(vid.duration));
        };
        vid.onerror = () => setChosen(f, 'video');
        vid.src = URL.createObjectURL(f);
      } else {
        setChosen(f, 'photo');
      }
    } catch (err) {
      setError(`Error al procesar el archivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function setChosen(f: File, type: 'photo' | 'video', duration?: number) {
    try {
      const url = URL.createObjectURL(f);
      setFile(f);
      setKind(type);
      setDurationSec(duration ?? null);
      setPreviewUrl(url);
    } catch (err) {
      setError(`Error al generar la vista previa: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function sendFile() {
    if (!file) return;
    setSendDisabled(true);
    setPanel('sending');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${API_URL}/mobile-upload/${session}`, { method: 'POST', body: form });
      if (res.status === 410 || res.status === 404) {
        setPanel('err');
        return;
      }
      if (!res.ok) throw new Error('server');
      setUploadedCount((c) => c + 1);
      reset();
      setPanel('ok');
    } catch {
      setPanel('select');
      setSendDisabled(false);
      setError('No se pudo enviar. Verifica tu conexión e intenta de nuevo.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 font-sans text-slate-900">
      <div className="flex w-full items-center justify-center gap-3 bg-portal-navy px-5 py-4 pb-3.5 text-center text-white">
        <Image
          src="/assets/gcm.jpg"
          alt="GCM Grupo Milcien"
          width={48}
          height={48}
          className="h-12 w-12 rounded-full border-2 border-white/40 bg-white object-contain p-1 shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
        />
        <div className="text-left">
          <h1 className="text-base font-bold">GCM Tickets</h1>
          <p className="mt-0.5 text-[11px] opacity-82">
            Grupo Milcien — {isPrestamo ? 'Fotos del equipo (préstamo)' : isInventario ? 'Foto del equipo para inventario' : 'Adjuntar evidencia al ticket'}
          </p>
        </div>
      </div>

      {panel === 'select' && (
        <div className="flex w-full max-w-110 flex-col items-center px-5 pt-6 pb-10">
          <div className="w-full rounded-[18px] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.09)]">
            <div className="mb-4.5 flex items-center gap-2.25 text-[15px] font-bold text-portal-navy-mid">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {isPrestamo ? `Toma una foto del equipo${uploadedCount ? ` (${uploadedCount} ya enviada${uploadedCount === 1 ? '' : 's'})` : ''}` : isInventario ? 'Toma la foto del equipo' : 'Selecciona el tipo de evidencia'}
            </div>
            {isPrestamo && (
              <div className="mb-3.5 rounded-[10px] border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-center text-xs text-blue-800">
                📸 Puedes tomar <strong>varias fotos</strong> del estado del equipo (distintos ángulos). Envía cada una y toma la siguiente.
              </div>
            )}

            {!file ? (
              <>
                <div className={isInventario ? 'mb-1.5' : 'mb-1.5 grid grid-cols-2 gap-3'}>
                  <label
                    htmlFor="filePhoto"
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 px-3 py-6 text-center text-sm font-semibold text-blue-800 active:scale-97"
                  >
                    <span className="text-3xl leading-none">📷</span>
                    <span className="text-[13px] font-bold">Tomar foto</span>
                    <span className="text-[11px] font-normal opacity-70">o elegir de galería</span>
                  </label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    id="filePhoto"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFileChosen(e.target, 'photo')}
                  />

                  {!isInventario && (
                    <>
                      <label
                        htmlFor="fileVideo"
                        className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 px-3 py-6 text-center text-sm font-semibold text-violet-900 active:scale-97"
                      >
                        <span className="text-3xl leading-none">🎬</span>
                        <span className="text-[13px] font-bold">Grabar video</span>
                        <span className="text-[11px] font-normal opacity-70">máx. 15 segundos</span>
                      </label>
                      <input
                        ref={videoInputRef}
                        type="file"
                        id="fileVideo"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => onFileChosen(e.target, 'video')}
                      />
                    </>
                  )}
                </div>

                {!isInventario && (
                  <div className="mt-2.5 w-full rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-center text-xs text-amber-800">
                    ⏱ Los videos se limitan a <strong>15 segundos</strong>. El selector de tu celular te permite grabar directamente.
                  </div>
                )}
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-3.5">
                {kind === 'photo' && previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Vista previa" className="block max-h-70 w-full rounded-[14px] border border-slate-200 object-contain" />
                )}
                {kind === 'video' && previewUrl && (
                  <video src={previewUrl} controls playsInline className="block max-h-65 w-full rounded-[14px] border border-slate-200 bg-black" />
                )}
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-center text-xs font-semibold break-all text-sky-700">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
                {durationSec !== null && (
                  <div className="rounded-full border border-violet-300 bg-violet-50 px-3.5 py-1 text-xs font-bold text-violet-700">⏱ {durationSec}s</div>
                )}
                <button
                  type="button"
                  onClick={sendFile}
                  disabled={sendDisabled}
                  className="mt-1 w-full rounded-[13px] bg-blue-500 p-4 text-base font-bold text-white active:scale-98 disabled:opacity-50"
                >
                  {isInventario ? 'Enviar foto' : 'Enviar evidencia'}
                </button>
                <button type="button" onClick={reset} className="mt-2 w-full rounded-[13px] bg-slate-100 p-3.25 text-sm font-bold text-slate-600 active:scale-98">
                  Elegir otra
                </button>
              </div>
            )}

            {error && <div className="mt-3 w-full rounded-[10px] bg-red-100 px-3.5 py-3 text-center text-[13px] text-red-700">{error}</div>}
          </div>
        </div>
      )}

      {panel === 'sending' && (
        <div className="flex w-full max-w-110 flex-col items-center px-5 pt-6 pb-10">
          <div className="w-full rounded-[18px] bg-white px-5 py-10.5 text-center shadow-[0_4px_24px_rgba(0,0,0,0.09)]">
            <div className="mx-auto mb-4.5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
            <h2 className="mb-2 text-xl font-extrabold">Enviando…</h2>
            <p className="text-sm leading-relaxed text-slate-500">Espera un momento, no cierres esta pantalla</p>
          </div>
        </div>
      )}

      {panel === 'ok' && (
        <div className="flex w-full max-w-110 flex-col items-center px-5 pt-6 pb-10">
          <div className="w-full rounded-[18px] bg-white px-5 py-10.5 text-center shadow-[0_4px_24px_rgba(0,0,0,0.09)]">
            <div className="mb-3.5 text-[58px] leading-none">✅</div>
            {isPrestamo ? (
              finished ? (
                <>
                  <h2 className="mb-2 text-xl font-extrabold">
                    ¡Listo! {uploadedCount} foto{uploadedCount === 1 ? '' : 's'} enviada{uploadedCount === 1 ? '' : 's'}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-500">
                    Ya puedes cerrar esta pantalla.
                    <br />
                    Las fotos aparecen en la PC automáticamente.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-xl font-extrabold">
                    {uploadedCount} foto{uploadedCount === 1 ? '' : 's'} enviada{uploadedCount === 1 ? '' : 's'}
                  </h2>
                  <p className="mb-5 text-sm leading-relaxed text-slate-500">
                    Toma otra foto del equipo o presiona <strong>Listo</strong> cuando termines.
                    <br />
                    Aparecerán en la PC automáticamente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanel('select')}
                    className="w-full rounded-[13px] bg-blue-500 p-4 text-base font-bold text-white active:scale-98"
                  >
                    📷 Tomar otra foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinished(true)}
                    className="mt-2.5 w-full rounded-[13px] bg-slate-100 p-3.5 text-sm font-bold text-slate-600 active:scale-98"
                  >
                    ✓ Listo, terminé
                  </button>
                </>
              )
            ) : (
              <>
                <h2 className="mb-2 text-xl font-extrabold">Evidencia enviada</h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Puedes cerrar esta pantalla.
                  <br />
                  Aparecerá en la PC automáticamente.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {panel === 'err' && (
        <div className="flex w-full max-w-110 flex-col items-center px-5 pt-6 pb-10">
          <div className="w-full rounded-[18px] bg-white px-5 py-10.5 text-center shadow-[0_4px_24px_rgba(0,0,0,0.09)]">
            <div className="mb-3.5 text-[58px] leading-none">⚠️</div>
            <h2 className="mb-2 text-xl font-extrabold">Código expirado</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Este código QR ya no es válido.
              <br />
              Genera uno nuevo desde la PC.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Página `/mobile-upload`. Envuelta en `Suspense` porque {@link MobileUploadInner} usa `useSearchParams`. */
export default function MobileUploadPage() {
  return (
    <Suspense fallback={null}>
      <MobileUploadInner />
    </Suspense>
  );
}
