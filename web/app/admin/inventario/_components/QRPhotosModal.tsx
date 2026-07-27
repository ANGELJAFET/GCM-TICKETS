'use client';

import { useEffect, useRef, useState } from 'react';
import { IconQrcode, IconRefresh, IconX, IconCheck } from '@tabler/icons-react';
import { Modal } from '@/components/ui';
import { api, API_URL, fileUrl } from '@/lib/api';
import type { MobilePhoto } from './QRPhotoModal';

interface QRPhotosModalProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el token de sesión y todas las fotos recibidas al confirmar; el padre guarda el token para asociarlo al registrar el préstamo. */
  onConfirm: (token: string, files: MobilePhoto[]) => void;
}

/**
 * Estado del flujo multi-foto por QR:
 * `loading` (creando sesión) → `active` (QR visible; el celular puede subir
 * varias fotos, que van apareciendo con polling cada 2s) → `expired` (venció
 * la sesión, 5 min). A diferencia de {@link QRPhotoModal} (una sola foto), el
 * polling no se detiene al recibir la primera: sigue para acumular más.
 */
type QRState = 'loading' | 'active' | 'expired';

/** Duración de la sesión de subida móvil, debe coincidir con `SESSION_TTL` del backend (`mobileSessions.ts`). */
const SESSION_MS = 5 * 60 * 1000;

/**
 * Variante multi-foto de {@link QRPhotoModal}: genera un QR para tomar
 * **varias** fotos del equipo desde el celular (estado al momento de la
 * entrega en un préstamo). Reutiliza el mismo mecanismo de sesión temporal
 * (`api/src/routes/mobileUpload.ts`); pasa `type=prestamo` para que la página
 * móvil ofrezca "tomar otra foto".
 */
export function QRPhotosModal({ open, onClose, onConfirm }: QRPhotosModalProps) {
  const [state, setState] = useState<QRState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<MobilePhoto[]>([]);
  const [countdown, setCountdown] = useState('5:00');
  const [qrImgBust, setQrImgBust] = useState(0);
  const expiresAtRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }

  async function startSession(onFailure: () => void) {
    setState('loading');
    setFiles([]);
    setToken(null);
    try {
      const res = await api<{ token: string }>('/mobile-upload/session', { method: 'POST', body: {} });
      setToken(res.token);
      expiresAtRef.current = Date.now() + SESSION_MS;
      setQrImgBust(Date.now());
      setState('active');

      pollRef.current = setInterval(async () => {
        try {
          const status = await api<{ status: string; files: MobilePhoto[] }>(`/mobile-upload/status/${res.token}`);
          // No se detiene el polling: se refresca la lista para ir sumando fotos.
          setFiles(status.files || []);
        } catch {
          stopTimers();
          setState('expired');
        }
      }, 2000);

      tickRef.current = setInterval(() => {
        const left = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
        const m = Math.floor(left / 60);
        const s = String(left % 60).padStart(2, '0');
        setCountdown(`${m}:${s}`);
        if (left <= 0) {
          stopTimers();
          setState('expired');
        }
      }, 1000);
    } catch {
      onFailure();
    }
  }

  useEffect(() => {
    if (!open) {
      stopTimers();
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        startSession(() => {
          if (!cancelled) onClose();
        });
      }
    });
    return () => {
      cancelled = true;
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <IconQrcode size={18} /> Tomar fotos del equipo con el celular
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            <IconX size={14} /> Cancelar
          </button>
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onConfirm(token!, files);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)]"
            >
              <IconCheck size={14} /> Usar {files.length} foto{files.length === 1 ? '' : 's'}
            </button>
          )}
        </>
      }
    >
      <div className="flex min-h-70 flex-col items-center justify-center gap-2.5 py-2">
        {state === 'loading' && (
          <>
            <div className="mb-2 h-10 w-10 animate-spin rounded-full border-4 border-admin-border border-t-admin-blue" />
            <p>Generando código QR…</p>
          </>
        )}

        {state === 'active' && token && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/mobile-upload/qr/${token}?t=${qrImgBust}&type=prestamo`}
              alt="Código QR"
              className="h-44 w-44 rounded-xl border-[3px] border-admin-border"
            />
            <div className="mt-1 flex w-full flex-col gap-1.5">
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">1</span>
                Escanea el QR con la cámara de tu celular
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">2</span>
                Toma varias fotos del estado del equipo (distintos ángulos)
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">3</span>
                Irán apareciendo aquí; presiona “Usar fotos” al terminar
              </div>
            </div>

            {files.length > 0 ? (
              <div className="mt-1.5 w-full">
                <div className="mb-1.5 text-[12px] font-semibold text-admin-green">
                  {files.length} foto{files.length === 1 ? '' : 's'} recibida{files.length === 1 ? '' : 's'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f.path + i}
                      src={fileUrl(f.path)}
                      alt={f.name}
                      className="h-14 w-14 rounded-lg border border-admin-border object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2.5 text-[13px] font-semibold text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="h-1.75 w-1.75 animate-pulse rounded-full bg-admin-blue" />
                Esperando fotos…
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-admin-gray">
              Expira en <strong>{countdown}</strong>
            </div>
          </>
        )}

        {state === 'expired' && (
          <>
            <div className="mb-2.5 text-4xl">⏱</div>
            <h3 className="text-base font-bold">Código expirado</h3>
            <p className="mt-1.5 text-center text-[13px] text-admin-text-sec dark:text-admin-dark-text-sec">
              {files.length > 0
                ? `Se recibieron ${files.length} foto${files.length === 1 ? '' : 's'}. Puedes usarlas o generar un nuevo QR.`
                : 'Genera uno nuevo para intentarlo de nuevo'}
            </p>
            <button
              type="button"
              onClick={() => startSession(onClose)}
              className="mt-4.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)]"
            >
              <IconRefresh size={14} /> Generar nuevo QR
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
