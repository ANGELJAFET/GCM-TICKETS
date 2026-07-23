'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { IconAlertTriangle, IconHelpCircle } from '@tabler/icons-react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title?: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Botón de confirmar en rojo, para acciones destructivas (eliminar, etc.). */
  danger?: boolean;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
}

interface ConfirmContextValue {
  /** Reemplaza a window.confirm(). Resuelve true si el usuario acepta. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Reemplaza a window.prompt(). Resuelve el texto, o null si se cancela. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

/**
 * Reemplazo de `window.confirm`/`window.prompt` basado en un modal propio
 * (necesario porque los diálogos nativos del navegador no se pueden estilizar
 * ni tematizar). Ver {@link ConfirmProvider} y {@link useConfirm}.
 */
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface DialogState {
  opts: PromptOptions;
  withInput: boolean;
  resolve: (value: boolean | string | null) => void;
}

/**
 * Provee `confirm()`/`prompt()` (ver {@link useConfirm}) a través de un único
 * modal compartido, renderizado una vez en el árbol y reutilizado para
 * cualquier confirmación o prompt de texto de la aplicación.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setInputValue('');
        setDialog({ opts, withInput: false, resolve: resolve as DialogState['resolve'] });
      }),
    []
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setInputValue(opts.defaultValue || '');
        setDialog({ opts, withInput: true, resolve: resolve as DialogState['resolve'] });
      }),
    []
  );

  const close = (value: boolean | string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const handleCancel = () => close(dialog?.withInput ? null : false);
  const handleConfirm = () => close(dialog?.withInput ? inputValue : true);

  const opts = dialog?.opts;
  const danger = !!opts?.danger;

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <Modal
        open={!!dialog}
        onClose={handleCancel}
        className="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-admin-text-sec hover:bg-black/[0.04] dark:text-admin-dark-text-sec dark:hover:bg-white/8"
            >
              {opts?.cancelText || 'Cancelar'}
            </button>
            <button
              type="button"
              autoFocus={!dialog?.withInput}
              onClick={handleConfirm}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 ${danger ? 'bg-admin-red' : 'bg-admin-blue'}`}
            >
              {opts?.confirmText || 'Aceptar'}
            </button>
          </>
        }
      >
        <div className="flex gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger
                ? 'bg-admin-red-light text-admin-red dark:bg-red-500/15 dark:text-red-300'
                : 'bg-admin-blue-light text-admin-blue dark:bg-blue-500/15 dark:text-blue-300'
            }`}
          >
            {danger ? <IconAlertTriangle size={20} /> : <IconHelpCircle size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            {opts?.title && <h3 className="text-[15px] font-bold">{opts.title}</h3>}
            {opts?.message && (
              <div className="mt-1 text-[13px] whitespace-pre-line text-admin-text-sec dark:text-admin-dark-text-sec">{opts.message}</div>
            )}
            {dialog?.withInput && (
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                placeholder={opts?.placeholder}
                className="mt-3 h-10 w-full rounded-lg border-[1.5px] border-admin-border bg-admin-light px-3 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
              />
            )}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Hook para pedir confirmación o texto al usuario vía modal. @throws Si se usa fuera de {@link ConfirmProvider}. */
export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de un ConfirmProvider');
  return ctx;
}
