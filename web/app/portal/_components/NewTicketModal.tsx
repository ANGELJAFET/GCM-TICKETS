'use client';

import { useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconNotes,
  IconTag,
  IconFlag,
  IconPaperclip,
  IconUpload,
  IconQrcode,
  IconFileCheck,
  IconDeviceMobile,
  IconSend,
  IconLoader2,
  IconTicket,
} from '@tabler/icons-react';
import { Modal, FormField, Select, Input, Textarea } from '@/components/ui';
import type { TicketCategoria, TicketPrioridad } from '@/lib/types';
import type { MobileFile } from './QRModal';

const CATEGORIAS: TicketCategoria[] = ['Hardware', 'Software', 'Red', 'Acceso', 'Otro'];
const PRIORIDADES: TicketPrioridad[] = ['Baja', 'Media', 'Alta', 'Crítica'];

export interface NewTicketData {
  title: string;
  desc: string;
  categoria: TicketCategoria;
  prioridad: TicketPrioridad;
  file: File | null;
  mobileToken: string | null;
}

interface NewTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewTicketData) => Promise<void>;
  onOpenQR: () => void;
  mobileToken: string | null;
  mobileFile: MobileFile | null;
  onClearMobileFile: () => void;
}

export function NewTicketModal({ open, onClose, onSubmit, onOpenQR, mobileToken, mobileFile, onClearMobileFile }: NewTicketModalProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [categoria, setCategoria] = useState<TicketCategoria>('Hardware');
  const [prioridad, setPrioridad] = useState<TicketPrioridad>('Media');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle('');
    setDesc('');
    setCategoria('Hardware');
    setPrioridad('Media');
    setFile(null);
    setTitleError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickLocalFile(f: File | null) {
    setFile(f);
    if (mobileToken || mobileFile) onClearMobileFile();
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    setSending(true);
    try {
      await onSubmit({ title: title.trim(), desc, categoria, prioridad, file, mobileToken: mobileFile ? mobileToken : null });
      reset();
    } finally {
      setSending(false);
    }
  }

  const hasMobilePreview = !!mobileFile;
  const kb = file ? (file.size / 1024).toFixed(0) : mobileFile ? (mobileFile.size / 1024).toFixed(0) : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <IconTicket size={18} /> Nueva solicitud de soporte
        </span>
      }
      footer={
        <>
          <button type="button" onClick={handleClose} className="rounded-[10px] border-[1.5px] border-portal-border bg-white px-5.5 py-2.5 text-[13px] font-bold text-portal-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-portal-navy to-portal-navy-mid px-5.5 py-2.5 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(26,46,107,0.38)] disabled:opacity-60"
          >
            {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />}
            {sending ? 'Enviando…' : 'Enviar ticket'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="" htmlFor="f-title">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-portal-text-sec uppercase">
            <IconAlertCircle size={13} className="text-portal-navy-mid" /> Título del problema *
          </label>
          <Input
            id="f-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleError(false);
            }}
            placeholder="Ej: No puedo iniciar sesión en el sistema"
            className={titleError ? 'border-portal-red' : ''}
          />
        </FormField>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-portal-text-sec uppercase">
            <IconNotes size={13} className="text-portal-navy-mid" /> Descripción del problema
          </label>
          <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Cuéntanos qué está pasando con el mayor detalle posible..." />
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[600px]:grid-cols-1">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-portal-text-sec uppercase">
              <IconTag size={13} className="text-portal-navy-mid" /> Categoría
            </label>
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as TicketCategoria)}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-portal-text-sec uppercase">
              <IconFlag size={13} className="text-portal-navy-mid" /> Prioridad
            </label>
            <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as TicketPrioridad)}>
              {PRIORIDADES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-portal-text-sec uppercase">
            <IconPaperclip size={13} className="text-portal-navy-mid" /> Foto o video adjunto{' '}
            <span className="text-[11px] font-normal tracking-normal text-portal-gray normal-case">(imagen o video corto — máx. 50 MB)</span>
          </label>

          <div
            onClick={() => !hasMobilePreview && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) pickLocalFile(f);
            }}
            className={
              'flex flex-col items-center gap-1.5 rounded-[10px] border-2 border-dashed px-4 py-5.5 text-center transition-all ' +
              (hasMobilePreview
                ? 'cursor-default border-portal-green bg-portal-green-light p-4'
                : file
                  ? 'cursor-pointer border-portal-green bg-portal-green-light'
                  : dragOver
                    ? 'cursor-pointer border-portal-accent bg-portal-accent-light'
                    : 'cursor-pointer border-portal-border bg-slate-50 hover:border-portal-accent hover:bg-portal-accent-light dark:bg-admin-dark-bg')
            }
          >
            {hasMobilePreview && mobileFile ? (
              <>
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(mobileFile.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mobileFile.path} alt="" className="mb-2 block max-h-50 w-full rounded-[10px] border border-emerald-200 bg-white/60 object-contain" />
                )}
                <span className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold">
                  <IconDeviceMobile size={16} className="text-portal-accent" />
                  <strong>{mobileFile.name}</strong>
                  <span className="font-normal text-portal-gray">{kb} KB · desde celular</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearMobileFile();
                    }}
                    className="ml-2 cursor-pointer text-[11px] font-bold text-portal-red hover:underline"
                  >
                    ✕ Quitar
                  </span>
                </span>
              </>
            ) : file ? (
              <span className="text-[13px] text-portal-text-sec">
                <IconFileCheck size={16} className="mr-1 inline text-portal-green" />
                {file.name} ({kb} KB){' '}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    pickLocalFile(null);
                  }}
                  className="ml-2 cursor-pointer text-[11px] font-bold text-portal-red hover:underline"
                >
                  ✕ Quitar
                </span>
              </span>
            ) : (
              <>
                <IconUpload size={26} className="text-portal-gray" />
                <span className="text-[13px] text-portal-text-sec">Haz clic o arrastra un archivo aquí</span>
                <span className="text-[10px] text-portal-gray">JPG, PNG, GIF, MP4, MOV — máx. 50 MB</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.webm"
            className="hidden"
            onChange={(e) => pickLocalFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={onOpenQR}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-portal-navy bg-white px-4.5 py-2.25 text-[12.5px] font-bold text-portal-navy hover:border-portal-navy-dark hover:bg-[#eef1f8] hover:text-portal-navy-dark dark:bg-admin-dark-surface dark:hover:bg-admin-dark-bg"
          >
            <IconQrcode size={16} /> Subir desde celular
          </button>
        </div>
      </div>
    </Modal>
  );
}
