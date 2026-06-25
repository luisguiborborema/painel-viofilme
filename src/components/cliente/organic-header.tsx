import { ChevronDown, Sprout } from "lucide-react";
import { FilterTabs } from "@/components/dashboard/filter-tabs";

const REDE_TABS = [
  { label: "Todas", value: "todas" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
];

export function OrganicHeader({ periodLabel }: { periodLabel: string }) {
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
        <FilterTabs param="rede" options={REDE_TABS} />
        <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
          {periodLabel}
          <ChevronDown className="h-4 w-4 text-muted" />
        </div>
      </div>
    </div>
  );
}
