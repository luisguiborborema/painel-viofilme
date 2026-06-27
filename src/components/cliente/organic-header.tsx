import { Sprout } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { ExportPdfButton } from "./export-pdf-button";

export function OrganicHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-emerald-300">
          <Sprout className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Resultados orgânicos
          </h1>
          <p className="text-sm text-muted">
            Crescimento e engajamento sem investimento pago
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelector />
        <ExportPdfButton />
      </div>
    </div>
  );
}
