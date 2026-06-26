import { Card } from "@/components/ui/card";
import { formatBRL, formatNumber } from "@/lib/utils";
import type { CLevel } from "@/lib/data/queries";

export function FunnelCard({ pipeline }: { pipeline: CLevel["pipeline"] }) {
  const max = Math.max(...pipeline.stages.map((s) => s.value), 1);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Funil comercial — receita em negociação
        </h2>
        <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
          ver CRM
        </button>
      </div>

      <ul className="space-y-3">
        {pipeline.stages.map((s) => (
          <li key={s.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink">
                {s.name}{" "}
                <span className="text-muted">({s.count})</span>
              </span>
              <span className="font-medium tabular-nums text-ink">
                {formatBRL(s.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-brand-500"
                style={{ width: `${(s.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span>
          Pipeline total:{" "}
          <span className="font-semibold text-ink">
            R$ {formatNumber(pipeline.total)}
          </span>
        </span>
        <span>
          Receita ponderada (prob.):{" "}
          <span className="font-semibold text-emerald-400">
            R$ {formatNumber(pipeline.weighted)}
          </span>
        </span>
        <span>
          Conversão acum.:{" "}
          <span className="font-semibold text-ink">
            {pipeline.conversionRate}%
          </span>
        </span>
      </div>
    </Card>
  );
}
