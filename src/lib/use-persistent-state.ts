"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Estado persistido em localStorage, seguro para SSR.
 *
 * Renderiza com `initial` no servidor e na primeira pintura; depois de montar,
 * sincroniza com o valor salvo (evita mismatch de hidratação). Use para
 * preferências de UI: sidebar recolhida, métricas selecionadas, filtros.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* ignore */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update, hydrated];
}
