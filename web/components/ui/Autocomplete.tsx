'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

interface AutocompleteProps<T> {
  items: T[];
  value: string;
  onChange: (text: string) => void;
  onSelect: (item: T) => void;
  getLabel: (item: T) => string;
  getDetail?: (item: T) => string | undefined;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

// Generaliza el patrón hand-rolled de position/show/filter/select que admin.js
// repetía para responsable/empleado/ítem de préstamo (_usuariosDdRender, etc.)
// en un único componente reutilizable.
export function Autocomplete<T>({
  items,
  value,
  onChange,
  onSelect,
  getLabel,
  getDetail,
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
                <span className="font-medium">{getLabel(item)}</span>
                {getDetail?.(item) && <span className="text-xs opacity-60">{getDetail(item)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
