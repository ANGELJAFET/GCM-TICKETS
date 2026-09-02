/**
 * Helpers puros compartidos por las vistas del módulo de inventario:
 * etiquetas/colores de estado y condición, cálculo de disponibilidad
 * (unidad vs. lote por cantidad), filtrado de equipos/préstamos por texto
 * libre + estado, y estado de garantía.
 */
import type { InventoryItem, InvEstado, InvCondicion, Loan } from '@/lib/types';
import { matchesQuery } from '@/lib/search';

/** Etiqueta legible por estado de inventario. */
export const INV_ESTADO_LABEL: Record<InvEstado, string> = {
  disponible: 'Disponible',
  en_uso: 'En uso',
  en_prestamo: 'En préstamo',
  en_reparacion: 'En reparación',
  de_baja: 'De baja',
};

/** Clases de color (badge) por estado de inventario. */
export const INV_ESTADO_CLS: Record<InvEstado, string> = {
  disponible: 'bg-admin-green-light text-emerald-800',
  en_uso: 'bg-admin-blue-light text-blue-700',
  en_prestamo: 'bg-admin-amber-light text-amber-800',
  en_reparacion: 'bg-admin-red-light text-red-800',
  de_baja: 'bg-admin-light text-admin-gray',
};

/** Etiqueta legible por condición física del equipo. */
export const CONDICION_LABEL: Record<InvCondicion, string> = {
  nuevo: 'Nuevo',
  excelente: 'Excelente',
  bueno: 'Bueno',
  regular: 'Regular',
  danado: 'Dañado',
};

/** Clases de color (badge) por condición física del equipo. */
export const CONDICION_CLS: Record<InvCondicion, string> = {
  nuevo: 'bg-admin-purple-light text-violet-700',
  excelente: 'bg-admin-green-light text-emerald-800',
  bueno: 'bg-admin-blue-light text-blue-700',
  regular: 'bg-admin-amber-light text-amber-800',
  danado: 'bg-admin-red-light text-red-800',
};

/**
 * Cuántas unidades quedan libres: 1 para equipos "por unidad" (o 0 si ya
 * están prestados), o el remanente del lote (`cantidadTotal - cantidadPrestada`)
 * para equipos "por cantidad".
 */
export function invDisponible(i: InventoryItem): number {
  if (i.tipoManejo === 'cantidad') return Math.max((i.cantidadTotal || 0) - (i.cantidadPrestada || 0), 0);
  return i.estado === 'disponible' ? 1 : 0;
}

/** `true` si el equipo/lote tiene al menos una unidad disponible para prestar. */
export function puedePrestar(i: InventoryItem): boolean {
  if (i.tipoManejo === 'cantidad') return i.estado === 'disponible' && invDisponible(i) > 0;
  return i.estado === 'disponible';
}

/** Clave para agrupar equipos "iguales" (mismo tipo+marca+modelo) sin importar el N° de serie — usada por el modal de "equipos similares". */
export function invGroupKey(item: InventoryItem): string {
  return [item.tipo, item.marca, item.modelo].map((v) => (v || '').trim().toLowerCase()).join('|');
}

/**
 * Todo lo buscable de un equipo en un solo texto: código, tipo, marca,
 * modelo, N° de serie, color, ubicación, responsable, notas, condición y
 * estado. Lo usan tanto el buscador de la vista "Equipos" como el
 * autocompletado de equipos del modal de préstamo.
 */
export function invSearchText(i: InventoryItem): string {
  return [
    i.id,
    i.tipo,
    i.marca,
    i.modelo,
    i.serie,
    i.color,
    i.ubicacion,
    i.responsable,
    i.notas,
    i.fechaIngreso,
    CONDICION_LABEL[i.condicion] || i.condicion,
    INV_ESTADO_LABEL[i.estado] || i.estado,
    i.tipoManejo === 'cantidad' ? 'lote cantidad stock' : 'unidad serie',
    i.garantia ? 'garantia' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Filtra equipos por texto libre ({@link matchesQuery} sobre {@link invSearchText}:
 * todos los términos deben aparecer, en cualquier orden y sobre cualquier campo,
 * ignorando palabras de relleno — "dell color negro" encuentra las Dell negras),
 * por `estado` y por `condicion` exactos. Para ítems de tipo `'cantidad'`,
 * los estados `'en_prestamo'`/`'disponible'` se derivan de `cantidadPrestada`
 * en vez de comparar contra `item.estado` directamente.
 * @param items Equipos a filtrar.
 * @param query Texto de búsqueda libre (vacío = sin filtro de texto).
 * @param estado Estado exacto a filtrar (vacío = todos los estados).
 * @param desde Fecha de ingreso mínima (`YYYY-MM-DD`, inclusive; vacío = sin límite inferior).
 * @param hasta Fecha de ingreso máxima (`YYYY-MM-DD`, inclusive; vacío = sin límite superior).
 */
export function filterInventory(items: InventoryItem[], query: string, estado: string, desde = '', hasta = '', condicion = ''): InventoryItem[] {
  return items.filter((i) => {
    if (condicion && i.condicion !== condicion) return false;
    if (estado) {
      if (i.tipoManejo === 'cantidad') {
        const prestadas = i.cantidadPrestada || 0;
        const disponibles = (i.cantidadTotal || 0) - prestadas;
        if (estado === 'en_prestamo' && prestadas === 0) return false;
        if (estado === 'disponible' && disponibles <= 0) return false;
        if (estado !== 'en_prestamo' && estado !== 'disponible' && i.estado !== estado) return false;
      } else if (i.estado !== estado) {
        return false;
      }
    }
    // Comparación lexicográfica de fechas ISO (YYYY-MM-DD), inclusiva en ambos extremos.
    if (desde && (i.fechaIngresoISO || '') < desde) return false;
    if (hasta && (i.fechaIngresoISO || '') > hasta) return false;
    return matchesQuery(invSearchText(i), query);
  });
}

function loanSearchText(l: Loan): string {
  return [
    l.id,
    l.inventoryId,
    l.equipoDesc,
    l.empleado,
    l.departamento,
    l.autorizadoPor,
    l.notas,
    l.notaDevolucion,
    l.fechaPrestamo,
    l.fechaDevolucionReal,
    (l.condicionDevolucion && CONDICION_LABEL[l.condicionDevolucion]) || l.condicionDevolucion || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Mismo criterio que {@link filterInventory}: texto libre (todos los
 * términos deben aparecer, en cualquier orden) + filtro exacto de estado.
 * @param estado `'activo' | 'devuelto' | ''` — a diferencia del de inventario, no hay que derivar nada (`Loan.estado` ya es exactamente eso).
 * @param desde Fecha de préstamo mínima (`YYYY-MM-DD`, inclusive; vacío = sin límite inferior).
 * @param hasta Fecha de préstamo máxima (`YYYY-MM-DD`, inclusive; vacío = sin límite superior).
 */
export function filterLoans(loans: Loan[], query: string, estado: string, desde = '', hasta = ''): Loan[] {
  return loans.filter((l) => {
    if (estado && l.estado !== estado) return false;
    if (desde && (l.fechaPrestamoISO || '') < desde) return false;
    if (hasta && (l.fechaPrestamoISO || '') > hasta) return false;
    return matchesQuery(loanSearchText(l), query);
  });
}

/** Resultado de {@link garantiaInfo}: color, etiqueta y proveedor a mostrar. */
export interface GarantiaInfo {
  tone: 'green' | 'amber' | 'red' | 'gray';
  label: string;
  proveedor?: string;
}

/**
 * Calcula el estado visual de la garantía de un equipo según su fecha de
 * vencimiento: sin `vence` → gris genérico; vencida → rojo; vence en ≤30
 * días → ámbar con conteo de días; si no, verde ("activa").
 * @returns `null` si el equipo no tiene datos de garantía.
 */
export function garantiaInfo(garantia: InventoryItem['garantia']): GarantiaInfo | null {
  if (!garantia) return null;
  if (!garantia.vence) return { tone: 'gray', label: 'Con garantía', proveedor: garantia.proveedor };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vence = new Date(garantia.vence);
  const dias = Math.round((vence.getTime() - today.getTime()) / 86400000);
  if (dias < 0) return { tone: 'red', label: 'Garantía vencida', proveedor: garantia.proveedor };
  if (dias <= 30) return { tone: 'amber', label: `Garantía: ${dias} días`, proveedor: garantia.proveedor };
  return { tone: 'green', label: 'Garantía activa', proveedor: garantia.proveedor };
}
