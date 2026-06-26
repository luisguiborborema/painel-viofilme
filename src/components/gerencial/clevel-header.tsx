import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = ["Junho", "Últimos 3m", "2026"];

export function CLevelHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <Gauge className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Hub de gestão — visão C-Level
          </h1>
          <p className="text-sm text-muted">Viofilme · {subtitle}</p>
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-line bg-surface p-1">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              i === 0 ? "bg-brand-500 text-white" : "text-muted",
            )}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
