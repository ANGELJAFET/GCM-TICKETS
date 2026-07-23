import clsx from 'clsx';
import {
  IconPackage,
  IconBarcode,
  IconStack,
  IconMapPin,
  IconUser,
  IconSparkles,
  IconCalendarPlus,
  IconShield,
  IconShieldOff,
  IconShieldExclamation,
  IconShieldCheck,
  IconExchange,
  IconCheck,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import type { InventoryItem } from '@/lib/types';
import { fileUrl } from '@/lib/api';
import { INV_ESTADO_LABEL, INV_ESTADO_CLS, CONDICION_LABEL, CONDICION_CLS, invDisponible, puedePrestar, garantiaInfo } from '../_lib/invHelpers';

const GARANTIA_ICON = { green: IconShieldCheck, amber: IconShieldExclamation, red: IconShieldOff, gray: IconShield };
const GARANTIA_CLS = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', gray: 'bg-admin-light text-admin-gray' };

interface InvCardProps {
  item: InventoryItem;
  onOpenSimilar: (id: string) => void;
  onLoan: (id: string) => void;
  onReturn: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Tarjeta de un equipo/lote del inventario: foto o ícono, badge de
 * estado/disponibilidad (distinto para ítems por lote), datos clave (serie
 * o cantidad, ubicación, responsable, condición, garantía) y acciones
 * (prestar/devolver según {@link puedePrestar}, editar, eliminar). El header
 * es clicable y abre el modal de "equipos similares".
 */
export function InvCard({ item, onOpenSimilar, onLoan, onReturn, onEdit, onDelete }: InvCardProps) {
  const isCant = item.tipoManejo === 'cantidad';
  const disponible = isCant ? invDisponible(item) : null;
  const showCantBadge = isCant && item.estado === 'disponible';
  const garantia = garantiaInfo(item.garantia);
  const GarantiaIcon = garantia ? GARANTIA_ICON[garantia.tone] : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-admin-border bg-white p-4.5 shadow-[var(--shadow-adm-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-adm)] dark:border-white/10 dark:bg-admin-dark-surface">
      <div
        onClick={() => onOpenSimilar(item.id)}
        title="Ver equipos similares"
        className="-m-1 flex cursor-pointer items-start gap-3 rounded-[10px] p-1 transition-colors hover:bg-admin-light dark:hover:bg-admin-dark-alt"
      >
        {item.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(item.foto)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-admin-blue-light to-blue-100 text-admin-blue">
            <IconPackage size={22} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {item.marca}
            {item.modelo ? ` ${item.modelo}` : ''}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-admin-text-sec">
            {item.id} · {item.tipo}
            {item.color ? ` · ${item.color}` : ''}
          </div>
        </div>
        {showCantBadge ? (
          <span className={clsx('shrink-0 self-start rounded-full px-2.25 py-0.75 text-[10px] font-bold tracking-wide uppercase', (disponible || 0) > 0 ? 'bg-admin-green-light text-admin-green' : 'bg-admin-red-light text-admin-red')}>
            {disponible}/{item.cantidadTotal} disponibles
          </span>
        ) : (
          <span className={clsx('shrink-0 self-start rounded-full px-2.25 py-0.75 text-[10px] font-bold tracking-wide uppercase', INV_ESTADO_CLS[item.estado])}>
            {INV_ESTADO_LABEL[item.estado]}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.25">
        {item.serie && (
          <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
            <IconBarcode size={13} className="shrink-0 text-admin-gray" /> Serie: <strong>{item.serie}</strong>
          </div>
        )}
        {isCant && (
          <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
            <IconStack size={13} className="shrink-0 text-admin-gray" /> Lote: <strong>{item.cantidadTotal} unidades</strong> ({disponible} disponibles, {item.cantidadPrestada || 0} prestadas)
          </div>
        )}
        {item.ubicacion && (
          <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
            <IconMapPin size={13} className="shrink-0 text-admin-gray" /> Ubicación: {item.ubicacion}
          </div>
        )}
        {item.responsable && (
          <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
            <IconUser size={13} className="shrink-0 text-admin-gray" /> Responsable: {item.responsable}
          </div>
        )}
        <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
          <IconSparkles size={13} className="shrink-0 text-admin-gray" /> Condición:{' '}
          <span className={clsx('rounded-md px-1.75 py-0.5 text-[11px] font-bold', CONDICION_CLS[item.condicion])}>{CONDICION_LABEL[item.condicion]}</span>
        </div>
        <div className="flex items-center gap-1.75 text-xs text-admin-gray">
          <IconCalendarPlus size={13} className="shrink-0" /> Ingreso: {item.fechaIngreso}
        </div>
        {garantia && GarantiaIcon && (
          <div className="flex items-center gap-1.75 text-xs text-admin-text-sec">
            <GarantiaIcon size={13} className="shrink-0 text-admin-gray" />
            <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', GARANTIA_CLS[garantia.tone])}>{garantia.label}</span>
            {garantia.proveedor && <span> · {garantia.proveedor}</span>}
          </div>
        )}
        {item.notas && <div className="rounded-lg border-l-3 border-admin-border bg-admin-light px-2.5 py-2 text-[11px] leading-relaxed text-admin-text-sec italic dark:bg-admin-dark-alt">{item.notas}</div>}
      </div>

      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {puedePrestar(item) ? (
          <button type="button" onClick={() => onLoan(item.id)} className="inline-flex items-center gap-1.25 rounded-lg bg-linear-to-br from-admin-blue-dark to-admin-blue px-3.25 py-1.75 text-xs font-bold text-white shadow-[0_2px_6px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
            <IconExchange size={13} /> Prestar
          </button>
        ) : !isCant && item.estado === 'en_prestamo' ? (
          <button type="button" onClick={() => onReturn(item.id)} className="inline-flex items-center gap-1.25 rounded-lg bg-linear-to-br from-emerald-600 to-admin-green px-3.25 py-1.75 text-xs font-bold text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
            <IconCheck size={13} /> Devolver
          </button>
        ) : null}
        <button type="button" onClick={() => onEdit(item.id)} title="Editar" className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.75 text-xs font-bold text-admin-text-sec hover:border-admin-blue hover:bg-admin-blue-light hover:text-admin-blue dark:bg-admin-dark-alt">
          <IconEdit size={13} />
        </button>
        <button type="button" onClick={() => onDelete(item.id)} title="Eliminar" className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-red-200 bg-admin-red-light px-3 py-1.75 text-xs font-bold text-admin-red hover:bg-admin-red hover:text-white">
          <IconTrash size={13} />
        </button>
      </div>
    </div>
  );
}
