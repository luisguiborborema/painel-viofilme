"use client";

import { Card } from "@/components/ui/card";
import { ComboMrrChart } from "@/components/dashboard/charts";

const BAR = "#38bdf8";
const LINE = "#34d399";

export function MrrChartCard({
  data,
}: {
  data: { month: string; mrr: number; novos: number }[];
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          MRR &amp; novos clientes — Jan a Jun 2026
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAR }} />
            MRR (R$)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE }} />
            Novos clientes
          </span>
        </div>
      </div>
      <ComboMrrChart data={data} barColor={BAR} lineColor={LINE} />
    </Card>
  );
}
