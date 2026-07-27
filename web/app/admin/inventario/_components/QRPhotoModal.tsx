'use client';

import { useEffect, useRef, useState } from 'react';
import { IconQrcode, IconCircleCheck, IconRefresh, IconX, IconCheck } from '@tabler/icons-react';
import { Modal } from '@/components/ui';
import { api, API_URL } from '@/lib/api';

/** Archivo recibido a través de una sesión de subida móvil (foto del equipo). */
export interface MobilePhoto {
  name: string;
  size: number;
  path: string;
}

interface QRPhotoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (token: string, file: MobilePhoto) => void;
}

/**
 * Estado del flujo de captura de foto por QR:
 * `loading` (creando sesión) → `pending` (esperando que el celular suba el
 * archivo, con polling cada 2s) → `ready` (foto recibida, lista para
 * confirmar) o `expired` (venció el tiempo de la sesión, 5 min).
 */
type QRState = 'loading' | 'pending' | 'ready' | 'expired';

/** Duración de la sesión de subida móvil, debe coincidir con `SESSION_TTL` del backend (`mobileSessions.ts`). */
const SESSION_MS = 5 * 60 * 1000;

/**
 * Modal que genera un QR para tomar una foto del equipo desde el celular sin
 * iniciar sesión ahí (mismo mecanismo de sesión temporal que usan los
 * adjuntos de tickets, ver `portal/_components/QRModal.tsx` y
 * `api/src/routes/mobileUpload.ts`), adaptado con estilos del panel admin.
 * @param onConfirm Se llama con el token de sesión y el archivo recibido cuando el usuario confirma "Usar esta foto"; el padre guarda el token como `mobileToken` para asociarlo al guardar el equipo.
 */
export function QRPhotoModal({ open, onClose, onConfirm }: QRPhotoModalProps) {
  const [state, setState] = useState<QRState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<MobilePhoto | null>(null);
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
    setFile(null);
    setToken(null);
    try {
      const res = await api<{ token: string }>('/mobile-upload/session', { method: 'POST', body: {} });
      setToken(res.token);
      expiresAtRef.current = Date.now() + SESSION_MS;
      setQrImgBust(Date.now());
      setState('pending');

      pollRef.current = setInterval(async () => {
        try {
          const status = await api<{ status: string; file: MobilePhoto }>(`/mobile-upload/status/${res.token}`);
          if (status.status === 'ready') {
            stopTimers();
            setFile(status.file);
            setState('ready');
          }
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
          <IconQrcode size={18} /> Tomar foto del equipo con el celular
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            <IconX size={14} /> Cancelar
          </button>
          {state === 'ready' && file && (
            <button
              type="button"
              onClick={() => {
                onConfirm(token!, file);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)]"
            >
              <IconCheck size={14} /> Usar esta foto
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

        {state === 'pending' && token && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/mobile-upload/qr/${token}?t=${qrImgBust}&type=inventario`}
              alt="Código QR"
              className="h-50 w-50 rounded-xl border-[3px] border-admin-border"
            />
            <div className="mt-1 flex w-full flex-col gap-1.5">
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">1</span>
                Abre la cámara de tu celular
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">2</span>
                Apunta al código QR para escanearlo
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">3</span>
                Toma la foto del equipo
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-admin-text-sec dark:text-admin-dark-text-sec">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-[11px] font-extrabold text-white">4</span>
                La foto aparecerá aquí automáticamente
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-[13px] font-semibold text-admin-text-sec dark:text-admin-dark-text-sec">
              <span className="h-1.75 w-1.75 animate-pulse rounded-full bg-admin-blue" />
              Esperando foto…
            </div>
            <div className="mt-0.5 text-[11px] text-admin-gray">
              Expira en <strong>{countdown}</strong>
            </div>
          </>
        )}

        {state === 'ready' && file && (
          <>
            <div className="text-5xl leading-none text-admin-green">
              <IconCircleCheck size={56} />
            </div>
            <h3 className="text-base font-bold">Foto recibida</h3>
            <p className="text-center text-[13px] font-semibold text-admin-text-sec dark:text-admin-dark-text-sec">{file.name}</p>
            <p className="mt-1.5 text-center text-[13px] text-admin-text-sec dark:text-admin-dark-text-sec">Se adjuntará al equipo al guardarlo</p>
          </>
        )}

        {state === 'expired' && (
          <>
            <div className="mb-2.5 text-4xl">⏱</div>
            <h3 className="text-base font-bold">Código expirado</h3>
            <p className="mt-1.5 text-center text-[13px] text-admin-text-sec dark:text-admin-dark-text-sec">Genera uno nuevo para intentarlo de nuevo</p>
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
