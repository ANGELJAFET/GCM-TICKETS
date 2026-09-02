'use client';

import { useMemo, useState } from 'react';
import { IconUsersGroup, IconSearch, IconDeviceLaptop, IconFingerprint, IconTag, IconMapPin, IconPencil, IconMapPinOff } from '@tabler/icons-react';
import type { InventoryItem, Loan } from '@/lib/types';

const ESTADO_LABEL: Record<string, string> = { disponible: 'Disponible', en_uso: 'En uso', en_prestamo: 'Prestado', en_reparacion: 'En reparación', de_baja: 'De baja' };
const ESTADO_COLOR: Record<string, string> = { disponible: '#22c55e', en_uso: '#3b82f6', en_prestamo: '#f59e0b', en_reparacion: '#f97316', de_baja: '#ef4444' };
const SIN_UBICACION = 'Sin ubicación registrada';

/**
 * Un renglón dentro de un grupo. Para equipos de tipo `'unidad'` equivale al
 * equipo completo; para un lote por cantidad representa solo la porción de ese
 * lote que le toca al grupo (las unidades que tiene esa persona, o las que
 * siguen libres en la ubicación).
 */
interface Fila {
  item: InventoryItem;
  /** Unidades del lote que cubre este renglón; `null` en equipos de tipo `'unidad'`. */
  unidades: number | null;
  /** Estado con el que se pinta la etiqueta del renglón (un lote se ve "Prestado" en el grupo de la persona y "Disponible" en el de la ubicación). */
  estado: string;
}

/** Un grupo de equipos agrupados por responsable asignado (`'persona'`) o, si no tienen responsable, por ubicación física (`'ubicacion'`). */
interface Grupo {
  tipo: 'persona' | 'ubicacion';
  nombre: string;
  filas: Fila[];
  /** Solo para `'persona'`: `false` si el nombre viene de un préstamo a alguien que aún no tiene cuenta. */
  registrado: boolean;
}

interface ResponsablesViewProps {
  items: InventoryItem[];
  /** Préstamos completos: los activos reparten los lotes por cantidad entre las personas que tienen unidades. */
  loans: Loan[];
  onEdit: (id: string) => void;
}

/**
 * Vista "Responsables": agrupa el inventario por persona responsable
 * (alfabético) y, para los equipos sin responsable, por ubicación física
 * (los sin ubicación quedan al final). Incluye buscador en cliente sobre
 * nombre de grupo y campos del equipo.
 *
 * Una persona forma grupo propio aunque no tenga cuenta en el sistema: en ese
 * caso el nombre llega del préstamo activo (ver `sp_GetInventory`) y el grupo
 * se marca como "sin cuenta" para que se note por qué no es un usuario.
 *
 * Los lotes por cantidad no tienen un único responsable —pueden estar
 * repartidos entre varias personas a la vez—, así que se desglosan: cada
 * persona con unidades activas ve su porción, y las unidades que siguen libres
 * quedan en el grupo de la ubicación. Un lote totalmente prestado desaparece de
 * su ubicación, de modo que ningún renglón se cuenta dos veces.
 */
export function ResponsablesView({ items, loans, onEdit }: ResponsablesViewProps) {
  const [query, setQuery] = useState('');

  const grupos = useMemo(() => {
    const porPersona: Record<string, { filas: Fila[]; registrado: boolean }> = {};
    const porUbicacion: Record<string, Fila[]> = {};

    function addPersona(nombre: string, fila: Fila, registrado: boolean) {
      const g = (porPersona[nombre] = porPersona[nombre] || { filas: [], registrado: false });
      g.filas.push(fila);
      if (registrado) g.registrado = true;
    }
    function addUbicacion(item: InventoryItem, fila: Fila) {
      const ubicacion = (item.ubicacion || '').trim() || SIN_UBICACION;
      (porUbicacion[ubicacion] = porUbicacion[ubicacion] || []).push(fila);
    }

    // Unidades activas de cada lote por persona. Se suman los préstamos porque
    // la misma persona puede tener varias entregas abiertas del mismo lote.
    const unidadesPorItem: Record<string, Record<string, { unidades: number; registrado: boolean }>> = {};
    loans.forEach((l) => {
      if (l.estado !== 'activo') return;
      const pendientes = l.cantidad - l.cantidadDevuelta;
      const nombre = (l.empleado || '').trim();
      if (pendientes <= 0 || !nombre) return;
      const porNombre = (unidadesPorItem[l.inventoryId] = unidadesPorItem[l.inventoryId] || {});
      const acc = (porNombre[nombre] = porNombre[nombre] || { unidades: 0, registrado: false });
      acc.unidades += pendientes;
      if (l.empleadoRegistrado) acc.registrado = true;
    });

    items.forEach((i) => {
      if (i.tipoManejo === 'cantidad') {
        const prestadas = unidadesPorItem[i.id] || {};
        Object.entries(prestadas)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([nombre, { unidades, registrado }]) =>
            addPersona(nombre, { item: i, unidades, estado: 'en_prestamo' }, registrado)
          );
        // `cantidadPrestada` la calcula la API sobre los mismos préstamos activos,
        // así que se usa para que el conteo de libres cuadre con el resto del panel.
        const libres = (i.cantidadTotal || 0) - (i.cantidadPrestada || 0);
        if (libres > 0) addUbicacion(i, { item: i, unidades: libres, estado: i.estado });
        return;
      }
      const responsable = (i.responsable || '').trim();
      const fila: Fila = { item: i, unidades: null, estado: i.estado };
      if (responsable) addPersona(responsable, fila, i.responsableRegistrado);
      else addUbicacion(i, fila);
    });

    const personas: Grupo[] = Object.entries(porPersona)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nombre, g]) => ({ tipo: 'persona', nombre, filas: g.filas, registrado: g.registrado }));
    const ubicaciones: Grupo[] = Object.entries(porUbicacion)
      .sort(([a], [b]) => (a === SIN_UBICACION ? 1 : b === SIN_UBICACION ? -1 : a.localeCompare(b)))
      .map(([nombre, filas]) => ({ tipo: 'ubicacion', nombre, filas, registrado: true }));
    return [...personas, ...ubicaciones];
  }, [items, loans]);

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
    const searchData = [g.nombre, ...g.filas.map(({ item: i }) => `${i.marca || ''} ${i.modelo || ''} ${i.tipo || ''} ${i.serie || ''} ${i.id} ${i.ubicacion || ''} ${i.estado || ''}`)].join(' ').toLowerCase();
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
              <div
                className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${g.registrado ? 'bg-admin-blue' : 'bg-admin-gray'}`}
                title={g.registrado ? undefined : 'Persona sin cuenta en el sistema'}
              >
                {g.nombre[0]?.toUpperCase() || '?'}
              </div>
            ) : (
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-admin-light text-admin-gray dark:bg-admin-dark-alt">
                {g.nombre === SIN_UBICACION ? <IconMapPinOff size={16} /> : <IconMapPin size={16} />}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{g.nombre}</span>
                {g.tipo === 'persona' && !g.registrado && (
                  <span className="rounded-full bg-admin-light px-2 py-0.5 text-[10px] font-semibold text-admin-gray dark:bg-admin-dark-alt">Sin cuenta</span>
                )}
              </div>
              <div className="text-[11px] text-admin-gray">
                {g.filas.length} equipo{g.filas.length !== 1 ? 's' : ''} {g.tipo === 'persona' ? 'asignado' + (g.filas.length !== 1 ? 's' : '') : 'sin responsable'}
              </div>
            </div>
          </div>
          {g.filas.map((fila) => {
            const item = fila.item;
            const color = ESTADO_COLOR[fila.estado] || '#94a3b8';
            return (
              <div key={`${item.id}-${g.nombre}`} className="mb-1.25 flex items-center gap-3 rounded-lg bg-admin-light px-3 py-2.25 dark:bg-admin-dark-alt">
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
                    {fila.unidades !== null && (
                      <span>
                        {fila.unidades} de {item.cantidadTotal} uds. {g.tipo === 'persona' ? 'en su poder' : 'disponibles'}
                      </span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}20`, color }}>
                      {ESTADO_LABEL[fila.estado] || fila.estado}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => onEdit(item.id)} title="Ver / editar equipo" className="shrink-0 rounded-lg border-[1.5px] border-admin-border bg-white px-2.5 py-1.25 text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-surface dark:text-admin-dark-text-sec">
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
