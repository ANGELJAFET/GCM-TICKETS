'use client';

import { useEffect, useState } from 'react';

// Los cálculos de SLA necesitan "la hora actual", que es impura y no puede
// leerse directamente durante el render (regla react-hooks/purity). Se
// sincroniza como estado vía efecto — se actualiza sola, sin recargar tickets.
export function useNow(intervalMs = 60000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // Se difiere a un microtask para que el cuerpo del efecto no dispare
    // setState de forma síncrona (regla react-hooks/set-state-in-effect).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setNow(Date.now());
    });
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
