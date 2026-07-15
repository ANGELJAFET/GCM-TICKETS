'use client';

import { useState } from 'react';
import { IconExchange, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { Modal, FormField, Input, Select, Textarea, Autocomplete } from '@/components/ui';
import type { AdminUser, InventoryItem, UsuarioListado } from '@/lib/types';
import { invDisponible } from '../_lib/invHelpers';

export interface LoanFormValues {
  inventoryId: string;
  cantidad: string;
  empleado: string;
  departamento: string;
  fechaDevolucion: string;
  autorizadoPorId: string;
  notas: string;
}

const EMPTY_FORM: LoanFormValues = { inventoryId: '', cantidad: '1', empleado: '', departamento: '', fechaDevolucion: '', autorizadoPorId: '', notas: '' };

interface LoanModalProps {
  open: boolean;
  preselectedItemId: string | null;
  inventory: InventoryItem[];
  usuarios: UsuarioListado[];
  admins: AdminUser[];
  onClose: () => void;
  onSave: (values: LoanFormValues) => Promise<void>;
}

export function LoanModal({ open, preselectedItemId, inventory, usuarios, admins, onClose, onSave }: LoanModalProps) {
  // El padre remonta este componente (key en base a open/preselectedItemId)
  // cada vez que se abre, así que el estado se inicializa perezosamente a
  // partir de props en vez de sincronizarlo con un efecto.
  const [form, setForm] = useState<LoanFormValues>(() => ({ ...EMPTY_FORM, inventoryId: preselectedItemId || '' }));
  const [itemSearch, setItemSearch] = useState(() => {
    const pre = preselectedItemId ? inventory.find((i) => i.id === preselectedItemId) : null;
    return pre ? `${pre.marca} ${pre.modelo || pre.tipo} (${pre.id})` : '';
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const availableItems = inventory.filter((i) => i.estado === 'disponible' && invDisponible(i) > 0);
  const selectedItem = inventory.find((i) => i.id === form.inventoryId) || null;

  function set<K extends keyof LoanFormValues>(key: K, value: LoanFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.inventoryId) return setError('Selecciona un equipo.');
    if (!form.empleado.trim()) return setError('El nombre del empleado es requerido.');
    if (selectedItem?.tipoManejo === 'cantidad') {
      const cant = parseInt(form.cantidad, 10);
      if (!Number.isInteger(cant) || cant < 1) return setError('Indica una cantidad válida.');
      if (cant > invDisponible(selectedItem)) return setError(`Solo hay ${invDisponible(selectedItem)} unidades disponibles.`);
    }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error && e.message.includes('409') ? 'No hay suficiente disponibilidad de este equipo.' : 'Error al registrar préstamo.');
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
          <IconExchange size={17} /> Registrar préstamo
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-[10px] border-[1.5px] border-admin-border bg-white px-5 py-2.25 text-[13px] font-semibold text-admin-text-sec hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-linear-to-br from-admin-blue-dark to-admin-blue px-5 py-2.25 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(59,130,246,0.35)] disabled:opacity-60"
          >
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
            Registrar préstamo
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormField label="Equipo a prestar" required>
          <Autocomplete
            items={availableItems}
            value={itemSearch}
            onChange={(v) => {
              setItemSearch(v);
              if (!v) set('inventoryId', '');
            }}
            onSelect={(i) => {
              set('inventoryId', i.id);
              set('cantidad', '1');
              setItemSearch(`${i.marca} ${i.modelo || i.tipo} (${i.id})`);
            }}
            getLabel={(i) => `${i.marca} ${i.modelo || ''} ${i.tipo}`}
            getDetail={(i) => `${i.id}${i.tipoManejo === 'cantidad' ? ` · ${invDisponible(i)} disponibles de ${i.cantidadTotal}` : ' · Unidad individual'}${i.ubicacion ? ` · ${i.ubicacion}` : ''}`}
            placeholder="Buscar por marca, modelo, tipo, ubicación…"
          />
          {!availableItems.length && <div className="mt-1.5 rounded-lg border border-admin-red/20 bg-admin-red-light px-3 py-2 text-xs font-semibold text-red-800">No hay equipos disponibles para préstamo.</div>}
        </FormField>

        {selectedItem?.tipoManejo === 'cantidad' && (
          <FormField label="Cantidad a prestar" required>
            <Input type="number" min={1} max={invDisponible(selectedItem)} step={1} value={form.cantidad} onChange={(e) => set('cantidad', e.target.value)} />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Empleado / Responsable" required>
            <Autocomplete
              items={usuarios}
              value={form.empleado}
              onChange={(v) => set('empleado', v)}
              onSelect={(u) => {
                set('empleado', u.nombre);
                if (u.detalle && !form.departamento) set('departamento', u.detalle);
              }}
              getLabel={(u) => u.nombre}
              getDetail={(u) => u.detalle}
              placeholder="Nombre completo"
            />
          </FormField>
          <FormField label="Departamento">
            <Input value={form.departamento} onChange={(e) => set('departamento', e.target.value)} placeholder="Contabilidad, Ventas…" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Fecha estimada de devolución">
            <Input type="date" value={form.fechaDevolucion} onChange={(e) => set('fechaDevolucion', e.target.value)} />
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
