'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pill } from './Pill';

interface AutocompleteProps<T> {
  items: T[];
  value: string;
  onChange: (text: string) => void;
  onSelect: (item: T) => void;
  getLabel: (item: T) => string;
  getDetail?: (item: T) => string | undefined;
  /** Etiqueta corta junto al nombre (ej. distinguir portal vs panel admin). */
  getBadge?: (item: T) => { label: string; className: string } | null | undefined;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Campo de texto con lista desplegable filtrada en cliente (máx. 30
 * resultados), pensado para seleccionar una entidad (usuario, equipo, etc.)
 * por nombre. Genérico en `T`: el consumidor decide qué es cada ítem y cómo
 * mostrarlo vía `getLabel`/`getDetail`/`getBadge`. Cierra la lista al hacer
 * click fuera o al seleccionar un ítem.
 * @param props.items Universo de ítems a filtrar y mostrar.
 * @param props.value Texto actual del input (controlado por el consumidor).
 * @param props.onChange Se llama con el nuevo texto en cada tecleo.
 * @param props.onSelect Se llama con el ítem elegido al hacer click en una opción.
 * @param props.getLabel Texto principal a mostrar/filtrar por cada ítem.
 * @param props.getDetail Texto secundario opcional (línea gris debajo del label).
 * @param props.getBadge Etiqueta corta opcional junto al label (ej. distinguir portal vs panel admin).
 */
export function Autocomplete<T>({
  items,
  value,
  onChange,
  onSelect,
  getLabel,
  getDetail,
  getBadge,
  placeholder,
  className,
  inputClassName,
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? items.filter((it) => getLabel(it).toLowerCase().includes(q)) : items;
    return pool.slice(0, 30);
  }, [items, value, getLabel]);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={clsx(
          'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg',
          inputClassName
        )}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-admin-dark-surface">
          {filtered.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-admin-blue-light dark:hover:bg-admin-dark-alt"
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{getLabel(item)}</span>
                  {getBadge?.(item) && (
                    <Pill className={getBadge(item)!.className}>{getBadge(item)!.label}</Pill>
                  )}
                </span>
                {getDetail?.(item) && <span className="text-xs opacity-60">{getDetail(item)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
