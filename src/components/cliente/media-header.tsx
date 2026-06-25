import { BarChart3, ChevronDown, Download } from "lucide-react";

export function MediaHeader({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Campanhas &amp; performance
          </h1>
          <p className="text-sm text-muted">Mídia paga · Meta Ads + Google Ads</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Seletor de período (estático por enquanto) */}
        <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
          {periodLabel}
          <ChevronDown className="h-4 w-4 text-muted" />
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>
    </div>
  );
}
