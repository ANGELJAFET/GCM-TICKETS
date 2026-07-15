'use client';

import { useState } from 'react';
import { IconArrowBackUp, IconCheck, IconLoader2, IconPackage, IconUser, IconCalendar } from '@tabler/icons-react';
import { Modal } from '@/components/ui';
import type { InventoryItem, Loan } from '@/lib/types';

interface ReturnConfirmModalProps {
  open: boolean;
  loan: Loan | null;
  item: InventoryItem | undefined;
  onClose: () => void;
  onConfirm: (loanId: string) => Promise<void>;
}

export function ReturnConfirmModal({ open, loan, item, onClose, onConfirm }: ReturnConfirmModalProps) {
  // El padre remonta este componente (key en base a loan?.id) cada vez que
  // se abre, así que estos estados ya nacen limpios sin necesitar un efecto.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!loan) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-sm"
      title={
        <span className="flex items-center gap-2">
          <IconArrowBackUp size={17} /> Confirmar devolución
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(loan.id);
              } catch {
                setError('Error al registrar. Verifica la conexión.');
                setSaving(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)] disabled:opacity-60"
          >
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
            Confirmar devolución
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.75 text-[13px]">
          <IconPackage size={15} className="text-admin-blue" />
          Equipo:{' '}
          <strong>
            {item ? `${item.marca}${item.modelo ? ' ' + item.modelo : ''}` : loan.inventoryId}
          </strong>
          {item && <span className="text-xs text-admin-gray">{item.tipo}</span>}
        </div>
        <div className="flex items-center gap-1.75 text-[13px]">
          <IconUser size={15} className="text-admin-blue" />
          Prestado a: <strong>{loan.empleado}</strong>
          {loan.departamento && <span className="text-admin-gray"> · {loan.departamento}</span>}
        </div>
        <div className="flex items-center gap-1.75 text-xs text-admin-gray">
          <IconCalendar size={14} /> Desde: {loan.fechaPrestamo}
        </div>
        {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
      </div>
    </Modal>
  );
}

interface PartialReturnModalProps {
  open: boolean;
  loan: Loan | null;
  item: InventoryItem | undefined;
  onClose: () => void;
  onConfirm: (loanId: string, cantidad: number) => Promise<void>;
}

export function PartialReturnModal({ open, loan, item, onClose, onConfirm }: PartialReturnModalProps) {
  const restante = loan ? loan.cantidad - loan.cantidadDevuelta : 0;
  // El padre remonta este componente (key en base a loan?.id) cada vez que
  // se abre, así que estos estados ya nacen limpios sin necesitar un efecto.
  const [qty, setQty] = useState(restante);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loan) return null;
  const desc = item ? `${item.marca}${item.modelo ? ' ' + item.modelo : ''} — ${item.tipo}` : loan.inventoryId;

  async function handleConfirm() {
    if (!Number.isInteger(qty) || qty < 1 || qty > restante) {
      setError(`Ingresa un número entre 1 y ${restante}.`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onConfirm(loan!.id, qty);
    } catch {
      setError('Error al registrar. Verifica la conexión.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-sm"
      title={
        <span className="flex items-center gap-2">
          <IconArrowBackUp size={17} /> Registrar devolución
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)] disabled:opacity-60"
          >
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
            Registrar devolución
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="text-[13px]">
          <div className="mb-1">{desc}</div>
          <div>
            Prestadas: <strong>{loan.cantidad}</strong> · Devueltas: <strong>{loan.cantidadDevuelta}</strong> ·{' '}
            <span className="text-admin-blue">
              Pendientes: <strong>{restante}</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold">Unidades a devolver</label>
          <input
            type="number"
            min={1}
            max={restante}
            step={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
            className="w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3.5 py-2.5 text-[15px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
          />
        </div>
        {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
      </div>
    </Modal>
  );
}
