'use client';

import { useState } from 'react';
import { IconEdit, IconCheck, IconLoader2, IconPackage } from '@tabler/icons-react';
import { Modal, FormField, Input, Select, Textarea, Autocomplete } from '@/components/ui';
import type { AdminUser, Loan, UsuarioListado } from '@/lib/types';

/** Campos editables de un préstamo (compartidos por todos los equipos de un grupo). */
export interface EditLoanValues {
  empleado: string;
  departamento: string;
  fechaDevolucion: string;
  autorizadoPorId: string;
  notas: string;
  permanente: boolean;
}

interface EditLoanModalProps {
  open: boolean;
  /** Préstamo base (de él se toman los valores actuales). */
  loan: Loan | null;
  /** Todos los préstamos del grupo (o `[loan]` si es individual) — se muestran de solo lectura. */
  groupLoans: Loan[];
  usuarios: UsuarioListado[];
  admins: AdminUser[];
  onClose: () => void;
  onSave: (values: EditLoanValues) => Promise<void>;
}

/**
 * Modal para editar los datos de un préstamo (o de todo un grupo): empleado,
 * departamento, fecha estimada de devolución, autorizado por, notas y si es una
 * asignación permanente. Los equipos no se editan aquí (se muestran de solo
 * lectura); para cambiarlos se elimina el préstamo y se crea de nuevo.
 */
export function EditLoanModal({ open, loan, groupLoans, usuarios, admins, onClose, onSave }: EditLoanModalProps) {
  // El padre remonta este componente (key en base a loan?.id) al abrirlo, así
  // que el estado se inicializa perezosamente desde el préstamo base.
  const [form, setForm] = useState<EditLoanValues>(() => ({
    empleado: loan?.empleado || '',
    departamento: loan?.departamento || '',
    fechaDevolucion: loan?.fechaDevolucionEstimadaISO || '',
    autorizadoPorId: loan ? String(admins.find((a) => a.nombre === loan.autorizadoPor)?.id ?? '') : '',
    notas: loan?.notas || '',
    permanente: loan?.permanente || false,
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loan) return null;

  function set<K extends keyof EditLoanValues>(key: K, value: EditLoanValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.empleado.trim()) return setError('El nombre del empleado es requerido.');
    setError('');
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      setError('Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <IconEdit size={17} /> Editar préstamo
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)] disabled:opacity-60"
          >
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
            Guardar cambios
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormField label={groupLoans.length > 1 ? `Equipos (${groupLoans.length})` : 'Equipo'}>
          <div className="flex flex-col divide-y divide-admin-border overflow-hidden rounded-[10px] border border-admin-border dark:divide-white/10 dark:border-white/10">
            {groupLoans.map((l) => (
              <div key={l.id} className="flex items-center gap-2 bg-admin-light px-3 py-2 text-[13px] dark:bg-admin-dark-alt">
                <IconPackage size={14} className="text-admin-gray" />
                <span className="font-semibold">{l.equipoDesc || l.inventoryId}</span>
                <span className="font-mono text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
                  {l.inventoryId}
                  {l.cantidad > 1 ? ` · x${l.cantidad}` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-admin-gray">Para cambiar los equipos, elimina el préstamo y créalo de nuevo.</p>
        </FormField>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Empleado / Responsable" required>
            <Autocomplete
              items={usuarios}
              value={form.empleado}
              onChange={(v) => set('empleado', v)}
              onSelect={(u) => {
                set('empleado', u.nombre);
                if (u.detalle) set('departamento', u.detalle);
              }}
              getLabel={(u) => u.nombre}
              getDetail={(u) => u.detalle}
              getBadge={(u) => (u.esPortal ? { label: 'Portal', className: 'bg-admin-blue-light text-blue-700' } : { label: 'Panel admin', className: 'bg-admin-light text-admin-gray' })}
              placeholder="Nombre completo"
            />
          </FormField>
          <FormField label="Departamento">
            <Input value={form.departamento} onChange={(e) => set('departamento', e.target.value)} placeholder="Contabilidad, Ventas…" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Fecha estimada de devolución">
            <Input type="date" value={form.fechaDevolucion} disabled={form.permanente} onChange={(e) => set('fechaDevolucion', e.target.value)} />
            <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-admin-text-sec dark:text-admin-dark-text-sec">
              <input type="checkbox" checked={form.permanente} onChange={(e) => set('permanente', e.target.checked)} className="h-3.5 w-3.5" />
              Asignación permanente (sin devolución)
            </label>
          </FormField>
          <FormField label="Autorizado por">
            <Select value={form.autorizadoPorId} onChange={(e) => set('autorizadoPorId', e.target.value)}>
              <option value="">Sin especificar</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.rol})
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Notas">
          <Textarea rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Condiciones, observaciones…" />
        </FormField>

        {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
      </div>
    </Modal>
  );
}
