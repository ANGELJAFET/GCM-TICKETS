import { IconDevices } from '@tabler/icons-react';
import { Modal } from '@/components/ui';
import type { InventoryItem } from '@/lib/types';
import { InvCard } from './InvCard';

interface SimilarEquiposModalProps {
  open: boolean;
  items: InventoryItem[];
  nombre: string;
  onClose: () => void;
  onOpenSimilar: (id: string) => void;
  onLoan: (id: string) => void;
  onReturn: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Modal que muestra todos los equipos "iguales" (mismo tipo+marca+modelo,
 * ver `invGroupKey`) al que se abrió desde una tarjeta de inventario —
 * útil para ver de un vistazo cuántas unidades del mismo modelo hay y su
 * estado individual.
 */
export function SimilarEquiposModal({ open, items, nombre, onClose, onOpenSimilar, onLoan, onReturn, onEdit, onDelete }: SimilarEquiposModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-4xl"
      title={
        <span className="flex items-center gap-2">
          <IconDevices size={17} /> {nombre}{' '}
          <span className="font-normal text-admin-text-sec">
            ({items.length} equipo{items.length === 1 ? '' : 's'})
          </span>
        </span>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
        {items.map((item) => (
          <InvCard key={item.id} item={item} onOpenSimilar={onOpenSimilar} onLoan={onLoan} onReturn={onReturn} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </Modal>
  );
}
