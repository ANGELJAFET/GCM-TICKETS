import type { InventoryItem, InvEstado, InvCondicion, Loan } from '@/lib/types';

export const INV_ESTADO_LABEL: Record<InvEstado, string> = {
  disponible: 'Disponible',
  en_uso: 'En uso',
  en_prestamo: 'En préstamo',
  en_reparacion: 'En reparación',
  de_baja: 'De baja',
};

export const INV_ESTADO_CLS: Record<InvEstado, string> = {
  disponible: 'bg-admin-green-light text-emerald-800',
  en_uso: 'bg-admin-blue-light text-blue-700',
  en_prestamo: 'bg-admin-amber-light text-amber-800',
  en_reparacion: 'bg-admin-red-light text-red-800',
  de_baja: 'bg-admin-light text-admin-gray',
};

export const CONDICION_LABEL: Record<InvCondicion, string> = {
  nuevo: 'Nuevo',
  excelente: 'Excelente',
  bueno: 'Bueno',
  regular: 'Regular',
  danado: 'Dañado',
};

export const CONDICION_CLS: Record<InvCondicion, string> = {
  nuevo: 'bg-admin-purple-light text-violet-700',
  excelente: 'bg-admin-green-light text-emerald-800',
  bueno: 'bg-admin-blue-light text-blue-700',
  regular: 'bg-admin-amber-light text-amber-800',
  danado: 'bg-admin-red-light text-red-800',
};

// Cuántas unidades quedan libres — 1 para equipos "por unidad" (o 0 si ya
// están prestados), o el remanente del lote para equipos "por cantidad".
export function invDisponible(i: InventoryItem): number {
  if (i.tipoManejo === 'cantidad') return Math.max((i.cantidadTotal || 0) - (i.cantidadPrestada || 0), 0);
  return i.estado === 'disponible' ? 1 : 0;
}

export function puedePrestar(i: InventoryItem): boolean {
  if (i.tipoManejo === 'cantidad') return i.estado === 'disponible' && invDisponible(i) > 0;
  return i.estado === 'disponible';
}

// Clave para agrupar equipos "iguales" (mismo tipo+marca+modelo) sin importar
// el N° de serie — usada para el modal de "equipos similares".
export function invGroupKey(item: InventoryItem): string {
  return [item.tipo, item.marca, item.modelo].map((v) => (v || '').trim().toLowerCase()).join('|');
}

function normalize(s: string) {
  return s.toLowerCase();
}

function invSearchText(i: InventoryItem): string {
  return [
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

export function filterInventory(items: InventoryItem[], query: string, estado: string): InventoryItem[] {
  const q = normalize(query.trim());
  return items.filter((i) => {
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
    if (q) {
      const texto = invSearchText(i);
      const terminos = q.split(/\s+/);
      if (!terminos.every((t) => texto.includes(t))) return false;
    }
    return true;
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

// Mismo criterio que filterInventory: texto libre (todos los términos deben
// aparecer, en cualquier orden) + filtro exacto de estado. `estado` es
// 'activo' | 'devuelto' | '' — a diferencia del de inventario, no hay que
// derivar nada (Loan.estado ya es exactamente eso).
export function filterLoans(loans: Loan[], query: string, estado: string): Loan[] {
  const q = normalize(query.trim());
  return loans.filter((l) => {
    if (estado && l.estado !== estado) return false;
    if (q) {
      const texto = loanSearchText(l);
      const terminos = q.split(/\s+/);
      if (!terminos.every((t) => texto.includes(t))) return false;
    }
    return true;
  });
}

export interface GarantiaInfo {
  tone: 'green' | 'amber' | 'red' | 'gray';
  label: string;
  proveedor?: string;
}

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
