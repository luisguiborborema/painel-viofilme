import type { ReactNode } from "react";

/**
 * Barra de highlights (KPIs) para as fichas de contato e empresa — mesmo padrão
 * visual da ficha do negócio (DealHighlights), mantendo o tema atual.
 */
export function RecordHighlights({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="flex items-stretch overflow-x-auto rounded-2xl border border-line bg-surface">
      {items.map((it) => (
        <div key={it.label} className="min-w-[120px] flex-1 border-r border-line px-4 py-3 last:border-r-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{it.label}</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{it.value}</p>
        </div>
      ))}
    </div>
  );
}
