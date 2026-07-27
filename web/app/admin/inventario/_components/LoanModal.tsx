'use client';

import { useState } from 'react';
import { IconExchange, IconCheck, IconLoader2, IconCamera, IconTrash } from '@tabler/icons-react';
import { Modal, FormField, Input, Select, Textarea, Autocomplete } from '@/components/ui';
import type { AdminUser, InventoryItem, UsuarioListado } from '@/lib/types';
import { fileUrl } from '@/lib/api';
import { invDisponible } from '../_lib/invHelpers';
import { QRPhotosModal } from './QRPhotosModal';
import type { MobilePhoto } from './QRPhotoModal';

/** Valores del formulario de registro de un préstamo. */
export interface LoanFormValues {
  inventoryId: string;
  cantidad: string;
  empleado: string;
  departamento: string;
  fechaDevolucion: string;
  autorizadoPorId: string;
  notas: string;
  /** Tokens de sesiones de subida por QR con las fotos del estado del equipo al entregarlo. */
  mobileTokens: string[];
}

const EMPTY_FORM: LoanFormValues = { inventoryId: '', cantidad: '1', empleado: '', departamento: '', fechaDevolucion: '', autorizadoPorId: '', notas: '', mobileTokens: [] };

interface LoanModalProps {
  open: boolean;
  preselectedItemId: string | null;
  inventory: InventoryItem[];
  usuarios: UsuarioListado[];
  admins: AdminUser[];
  onClose: () => void;
  onSave: (values: LoanFormValues) => Promise<void>;
}

/**
 * Modal de registro de préstamo. Solo ofrece equipos disponibles
 * (`invDisponible(i) > 0`) en el autocompletado; si el equipo elegido es de
 * tipo `'cantidad'`, muestra un campo adicional para elegir cuántas
 * unidades prestar (acotado a lo disponible).
 * @param preselectedItemId Id de equipo preseleccionado (ej. al presionar "Prestar" desde una tarjeta de inventario).
 */
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
  // Fotos del estado del equipo al entregarlo, capturadas por QR. `photos`
  // guarda los archivos para la vista previa; los tokens viajan en el form.
  const [photos, setPhotos] = useState<MobilePhoto[]>([]);
  const [qrOpen, setQrOpen] = useState(false);

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

        <FormField label="Fotos de entrega (opcional)">
          <div className="flex flex-col gap-2">
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f.path + i}
                    src={fileUrl(f.path)}
                    alt={f.name}
                    className="h-16 w-16 rounded-lg border border-admin-border object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-admin-border bg-white px-3.5 py-2 text-[12.5px] font-semibold text-admin-text-sec hover:bg-slate-100 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-bg"
              >
                <IconCamera size={15} /> {photos.length ? 'Agregar más fotos' : 'Tomar fotos con el celular'}
              </button>
              {photos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotos([]);
                    set('mobileTokens', []);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-semibold text-admin-red hover:bg-admin-red-light"
                >
                  <IconTrash size={14} /> Quitar
                </button>
              )}
            </div>
            <p className="text-[11px] text-admin-gray">
              Se generará un QR para fotografiar el estado del equipo desde el celular; las fotos se adjuntan al comprobante de entrega.
            </p>
          </div>
        </FormField>

        {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
      </div>

      <QRPhotosModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConfirm={(token, files) => {
          setPhotos((prev) => [...prev, ...files]);
          set('mobileTokens', [...form.mobileTokens, token]);
        }}
      />
    </Modal>
  );
}
