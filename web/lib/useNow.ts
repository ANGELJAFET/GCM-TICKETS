'use client';

import { useEffect, useState } from 'react';

/**
 * Hook que expone "la hora actual" como estado reactivo, refrescado cada
 * `intervalMs`. Los cálculos de SLA necesitan la hora actual, que es impura
 * y no puede leerse directamente durante el render (regla
 * `react-hooks/purity`) — se sincroniza vía efecto en vez de recargar tickets.
 * @param intervalMs Frecuencia de refresco en milisegundos (default 60000, 1 minuto).
 * @returns El timestamp actual (`Date.now()`); `0` durante el primer render, antes de que el efecto corra.
 */
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
