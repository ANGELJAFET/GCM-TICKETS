'use client';

import { useMemo, useState } from 'react';
import { IconUsersGroup, IconSearch, IconDeviceLaptop, IconFingerprint, IconTag, IconMapPin, IconPencil, IconMapPinOff } from '@tabler/icons-react';
import type { InventoryItem } from '@/lib/types';

const ESTADO_LABEL: Record<string, string> = { disponible: 'Disponible', en_uso: 'En uso', en_prestamo: 'Prestado', en_reparacion: 'En reparación', de_baja: 'De baja' };
const ESTADO_COLOR: Record<string, string> = { disponible: '#22c55e', en_uso: '#3b82f6', en_prestamo: '#f59e0b', en_reparacion: '#f97316', de_baja: '#ef4444' };
const SIN_UBICACION = 'Sin ubicación registrada';

interface Grupo {
  tipo: 'persona' | 'ubicacion';
  nombre: string;
  items: InventoryItem[];
}

interface ResponsablesViewProps {
  items: InventoryItem[];
  onEdit: (id: string) => void;
}

export function ResponsablesView({ items, onEdit }: ResponsablesViewProps) {
  const [query, setQuery] = useState('');

  const grupos = useMemo(() => {
    const porPersona: Record<string, InventoryItem[]> = {};
    const porUbicacion: Record<string, InventoryItem[]> = {};
    items.forEach((i) => {
      const responsable = (i.responsable || '').trim();
      if (responsable) {
        (porPersona[responsable] = porPersona[responsable] || []).push(i);
      } else {
        const ubicacion = (i.ubicacion || '').trim() || SIN_UBICACION;
        (porUbicacion[ubicacion] = porUbicacion[ubicacion] || []).push(i);
      }
    });
    const personas: Grupo[] = Object.entries(porPersona)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nombre, list]) => ({ tipo: 'persona', nombre, items: list }));
    const ubicaciones: Grupo[] = Object.entries(porUbicacion)
      .sort(([a], [b]) => (a === SIN_UBICACION ? 1 : b === SIN_UBICACION ? -1 : a.localeCompare(b)))
      .map(([nombre, list]) => ({ tipo: 'ubicacion', nombre, items: list }));
    return [...personas, ...ubicaciones];
  }, [items]);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-5 py-15 text-center text-admin-gray">
        <IconUsersGroup size={56} className="opacity-20" />
        <p className="text-sm">Todavía no hay equipos registrados.</p>
      </div>
    );
  }

  const q = query.toLowerCase().trim();
  const filtered = grupos.filter((g) => {
    if (!q) return true;
    const searchData = [g.nombre, ...g.items.map((i) => `${i.marca || ''} ${i.modelo || ''} ${i.tipo || ''} ${i.serie || ''} ${i.id} ${i.ubicacion || ''} ${i.estado || ''}`)].join(' ').toLowerCase();
    return searchData.includes(q);
  });
  const totalPersonas = grupos.filter((g) => g.tipo === 'persona').length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-50 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-admin-gray" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, marca, modelo, serie, ubicación…"
            className="h-9.5 w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light pr-3.5 pl-9.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white dark:border-white/10 dark:bg-admin-dark-bg dark:focus:bg-admin-dark-bg"
          />
        </div>
        <div className="px-1 text-xs whitespace-nowrap text-admin-gray">
          {totalPersonas} persona{totalPersonas !== 1 ? 's' : ''} · {items.length} equipo{items.length !== 1 ? 's' : ''} en total
        </div>
      </div>

      {filtered.map((g) => (
        <div key={`${g.tipo}-${g.nombre}`} className="rounded-2xl border-[1.5px] border-admin-border bg-white p-4 dark:border-white/10 dark:bg-admin-dark-surface">
          <div className="mb-2.5 flex items-center gap-2.5">
            {g.tipo === 'persona' ? (
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-admin-blue text-base font-bold text-white">{g.nombre[0]?.toUpperCase() || '?'}</div>
            ) : (
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-admin-light text-admin-gray dark:bg-admin-dark-alt">
                {g.nombre === SIN_UBICACION ? <IconMapPinOff size={16} /> : <IconMapPin size={16} />}
              </div>
            )}
            <div>
              <div className="text-sm font-bold">{g.nombre}</div>
              <div className="text-[11px] text-admin-gray">
                {g.items.length} equipo{g.items.length !== 1 ? 's' : ''} {g.tipo === 'persona' ? 'asignado' + (g.items.length !== 1 ? 's' : '') : 'sin responsable'}
              </div>
            </div>
          </div>
          {g.items.map((item) => {
            const color = ESTADO_COLOR[item.estado] || '#94a3b8';
            return (
              <div key={item.id} className="mb-1.25 flex items-center gap-3 rounded-lg bg-admin-light px-3 py-2.25 dark:bg-admin-dark-alt">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px]" style={{ background: `${color}20` }}>
                  <IconDeviceLaptop size={15} style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {item.marca || ''} {item.modelo || ''} <span className="text-[11px] font-normal text-admin-gray">{item.tipo || ''}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] text-admin-gray">
                    {item.serie ? (
                      <span className="flex items-center gap-0.75">
                        <IconFingerprint size={10} /> {item.serie}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.75">
                        <IconTag size={10} /> {item.id}
                      </span>
                    )}
                    {item.ubicacion && (
                      <span className="flex items-center gap-0.75">
                        <IconMapPin size={10} /> {item.ubicacion}
                      </span>
                    )}
                    {item.tipoManejo === 'cantidad' && <span>{item.cantidadPrestada || 0} de {item.cantidadTotal} uds. prestadas</span>}
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}20`, color }}>
                      {ESTADO_LABEL[item.estado] || item.estado}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => onEdit(item.id)} title="Ver / editar equipo" className="shrink-0 rounded-lg border-[1.5px] border-admin-border bg-white px-2.5 py-1.25 text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-surface">
                  <IconPencil size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
