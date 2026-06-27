import { BarChart3, Download } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";

export function MediaHeader() {
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
        <PeriodSelector />
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>
    </div>
  );
}
