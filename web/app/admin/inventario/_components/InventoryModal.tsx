'use client';

import { useState } from 'react';
import { IconPackage, IconEdit, IconDeviceFloppy, IconLoader2, IconShieldCheck, IconLock, IconQrcode, IconPhoto } from '@tabler/icons-react';
import { Modal, FormField, Input, Select, Textarea, Autocomplete } from '@/components/ui';
import { fileUrl } from '@/lib/api';
import type { InventoryItem, InvCondicion, InvEstado, InvTipoManejo, UsuarioListado } from '@/lib/types';
import { INV_ESTADO_LABEL } from '../_lib/invHelpers';
import { QRPhotoModal, type MobilePhoto } from './QRPhotoModal';

/** Valores del formulario de alta/edición de un equipo de inventario. */
export interface InventoryFormValues {
  tipoManejo: InvTipoManejo;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  cantidadTotal: string;
  color: string;
  condicion: InvCondicion;
  estado: InvEstado;
  ubicacion: string;
  responsable: string;
  notas: string;
  garantia: { inicio: string; vence: string; proveedor: string } | null;
  mobileToken: string | null;
}

const EMPTY_FORM: InventoryFormValues = {
  tipoManejo: 'unidad',
  tipo: '',
  marca: '',
  modelo: '',
  serie: '',
  cantidadTotal: '',
  color: '',
  condicion: 'bueno',
  estado: 'disponible',
  ubicacion: '',
  responsable: '',
  notas: '',
  garantia: null,
  mobileToken: null,
};

/** Convierte un `InventoryItem` existente a los valores iniciales del formulario de edición. */
function itemToForm(item: InventoryItem): InventoryFormValues {
  return {
    tipoManejo: item.tipoManejo,
    tipo: item.tipo || '',
    marca: item.marca || '',
    modelo: item.modelo || '',
    serie: item.serie || '',
    cantidadTotal: item.cantidadTotal != null ? String(item.cantidadTotal) : '',
    color: item.color || '',
    condicion: item.condicion,
    estado: item.estado,
    ubicacion: item.ubicacion || '',
    responsable: item.responsable || '',
    notas: item.notas || '',
    garantia: item.garantia ? { inicio: item.garantia.inicio || '', vence: item.garantia.vence || '', proveedor: item.garantia.proveedor || '' } : null,
    mobileToken: null,
  };
}

interface InventoryModalProps {
  open: boolean;
  editingItem: InventoryItem | null;
  usuarios: UsuarioListado[];
  onClose: () => void;
  onSave: (id: string | null, values: InventoryFormValues) => Promise<void>;
}

/**
 * Modal de alta/edición de un equipo de inventario. El modo de manejo
 * (`tipoManejo`: por unidad o por cantidad) solo es editable al crear —
 * queda bloqueado una vez guardado. Incluye captura de foto vía
 * {@link QRPhotoModal} (QR + celular) y una sección opcional de garantía.
 */
export function InventoryModal({ open, editingItem, usuarios, onClose, onSave }: InventoryModalProps) {
  // El padre remonta este componente (key en base a open/editingItem) cada
  // vez que se abre, así que el estado se puede inicializar de forma
  // perezosa a partir de props en vez de sincronizarlo con un efecto.
  const [form, setForm] = useState<InventoryFormValues>(() => (editingItem ? itemToForm(editingItem) : EMPTY_FORM));
  const [tieneGarantia, setTieneGarantia] = useState(() => !!editingItem?.garantia);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [mobilePhoto, setMobilePhoto] = useState<MobilePhoto | null>(null);

  // Vista previa: la foto recién tomada por celular tiene prioridad sobre la
  // que ya tenía guardada el equipo (si se está editando uno existente).
  const photoPreviewUrl = mobilePhoto ? fileUrl(mobilePhoto.path) : editingItem?.foto ? fileUrl(editingItem.foto) : null;

  function set<K extends keyof InventoryFormValues>(key: K, value: InventoryFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const modoLocked = !!editingItem;
  const isCantidad = form.tipoManejo === 'cantidad';

  async function handleSave() {
    if (!form.tipo.trim()) return setError('El tipo de equipo es requerido.');
    if (!form.marca.trim()) return setError('La marca es requerida.');
    if (isCantidad) {
      if (!form.cantidadTotal || parseInt(form.cantidadTotal, 10) < 1) return setError('La cantidad total debe ser un número entero mayor o igual a 1.');
    } else if (!form.serie.trim()) {
      return setError('El número de serie es requerido.');
    }
    setError('');
    setSaving(true);
    try {
      await onSave(editingItem?.id || null, form);
    } catch {
      setError('Error al guardar. Verifica la conexión.');
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
          {editingItem ? <IconEdit size={17} /> : <IconPackage size={17} />}
          {editingItem ? `Editar — ${editingItem.id}` : 'Nuevo equipo'}
        </span>
      }
      className="max-w-xl"
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
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconDeviceFloppy size={15} />}
            {editingItem ? 'Guardar cambios' : 'Guardar equipo'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <FormField label="Modo de manejo" required>
          <div className="flex flex-wrap gap-5">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-admin-border bg-admin-light px-2.5 py-2 text-xs transition-colors hover:border-admin-blue hover:bg-admin-blue-light hover:text-admin-blue dark:bg-admin-dark-alt">
              <input type="radio" name="inv-modo" checked={!isCantidad} disabled={modoLocked} onChange={() => set('tipoManejo', 'unidad')} className="hidden" />
              <span className={`h-4 w-4 rounded border-2 ${!isCantidad ? 'border-admin-blue bg-admin-blue' : 'border-admin-gray'}`} />
              Por unidad (con N° de serie)
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-admin-border bg-admin-light px-2.5 py-2 text-xs transition-colors hover:border-admin-blue hover:bg-admin-blue-light hover:text-admin-blue dark:bg-admin-dark-alt">
              <input type="radio" name="inv-modo" checked={isCantidad} disabled={modoLocked} onChange={() => set('tipoManejo', 'cantidad')} className="hidden" />
              <span className={`h-4 w-4 rounded border-2 ${isCantidad ? 'border-admin-blue bg-admin-blue' : 'border-admin-gray'}`} />
              Por cantidad (lote: cables, mouse…)
            </label>
          </div>
          {modoLocked && <div className="mt-1 text-[11px] text-admin-gray">El modo no se puede cambiar después de creado.</div>}
        </FormField>

        <FormField label="Tipo de equipo" required>
          <Input value={form.tipo} onChange={(e) => set('tipo', e.target.value)} placeholder="Laptop, Impresora, Router, UPS…" />
        </FormField>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Marca" required>
            <Input value={form.marca} onChange={(e) => set('marca', e.target.value)} placeholder="Dell, HP, Apple…" />
          </FormField>
          <FormField label="Modelo">
            <Input value={form.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Latitude 5540…" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          {!isCantidad ? (
            <FormField label="N° de serie" required>
              <Input value={form.serie} onChange={(e) => set('serie', e.target.value)} placeholder="SN123456" />
            </FormField>
          ) : (
            <FormField label="Cantidad total" required>
              <Input type="number" min={1} step={1} value={form.cantidadTotal} onChange={(e) => set('cantidadTotal', e.target.value)} placeholder="Ej: 20" />
            </FormField>
          )}
          <FormField label="Color">
            <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Negro, Gris…" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Condición física">
            <Select value={form.condicion} onChange={(e) => set('condicion', e.target.value as InvCondicion)}>
              <option value="nuevo">Nuevo</option>
              <option value="excelente">Excelente</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="danado">Dañado</option>
            </Select>
          </FormField>
          <FormField label="Estado">
            {editingItem?.estado === 'en_prestamo' ? (
              <div className="flex items-center gap-1.5 rounded-[10px] bg-admin-light px-3.5 py-2.25 text-[13px] text-admin-gray dark:bg-admin-dark-alt">
                <IconLock size={12} /> En préstamo — gestionar desde <strong>Préstamos</strong>
              </div>
            ) : (
              <Select value={form.estado} onChange={(e) => set('estado', e.target.value as InvEstado)}>
                {Object.entries(INV_ESTADO_LABEL)
                  .filter(([val]) => val !== 'en_prestamo')
                  .map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
              </Select>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
          <FormField label="Ubicación">
            <Input value={form.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Bodega, Piso 2…" />
          </FormField>
          <FormField label="Responsable">
            <Autocomplete
              items={usuarios}
              value={form.responsable}
              onChange={(v) => set('responsable', v)}
              onSelect={(u) => set('responsable', u.nombre)}
              getLabel={(u) => u.nombre}
              getDetail={(u) => u.detalle}
              getBadge={(u) => (u.esPortal ? { label: 'Portal', className: 'bg-admin-blue-light text-blue-700' } : { label: 'Panel admin', className: 'bg-admin-light text-admin-gray' })}
              placeholder="Nombre del responsable (o selecciona un usuario)"
            />
          </FormField>
        </div>

        <FormField label="Foto del equipo">
          <div className="flex items-center gap-3">
            {photoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreviewUrl} alt="Foto del equipo" className="h-16 w-16 shrink-0 rounded-lg border border-admin-border object-cover dark:border-white/10" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-admin-border text-admin-gray dark:border-white/10">
                <IconPhoto size={22} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-admin-border bg-white px-3.5 py-2 text-[12.5px] font-semibold text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec"
            >
              <IconQrcode size={15} /> {photoPreviewUrl ? 'Reemplazar foto' : 'Tomar foto con el celular'}
            </button>
          </div>
        </FormField>

        <FormField label="Notas">
          <Textarea rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Observaciones adicionales…" />
        </FormField>

        <hr className="border-admin-border dark:border-white/10" />
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border dark:text-admin-dark-text-sec">
          <IconShieldCheck size={14} /> Garantía
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={tieneGarantia} onChange={(e) => { setTieneGarantia(e.target.checked); if (!e.target.checked) set('garantia', null); else set('garantia', form.garantia || { inicio: '', vence: '', proveedor: '' }); }} className="h-4 w-4" />
          Este equipo tiene garantía
        </label>
        {tieneGarantia && (
          <>
            <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
              <FormField label="Fecha de inicio">
                <Input type="date" value={form.garantia?.inicio || ''} onChange={(e) => set('garantia', { ...(form.garantia || { inicio: '', vence: '', proveedor: '' }), inicio: e.target.value })} />
              </FormField>
              <FormField label="Fecha de vencimiento" required>
                <Input type="date" value={form.garantia?.vence || ''} onChange={(e) => set('garantia', { ...(form.garantia || { inicio: '', vence: '', proveedor: '' }), vence: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Proveedor / N° de garantía">
              <Input value={form.garantia?.proveedor || ''} onChange={(e) => set('garantia', { ...(form.garantia || { inicio: '', vence: '', proveedor: '' }), proveedor: e.target.value })} placeholder="HP Inc., caso #12345…" />
            </FormField>
          </>
        )}

        {error && <div className="rounded-lg border border-admin-red/20 bg-admin-red-light px-3.5 py-2.5 text-xs font-semibold text-red-800">{error}</div>}
      </div>

      <QRPhotoModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConfirm={(token, file) => {
          set('mobileToken', token);
          setMobilePhoto(file);
        }}
      />
    </Modal>
  );
}
