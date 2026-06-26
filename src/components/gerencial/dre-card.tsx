import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import type { CLevel } from "@/lib/data/queries";

function Row({
  label,
  value,
  negative = false,
  strong = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn(strong ? "font-medium text-ink" : "text-muted")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          negative ? "text-rose-400" : strong ? "font-semibold text-ink" : "text-ink",
        )}
      >
        {negative ? "− " : ""}
        {formatBRL(value)}
      </span>
    </div>
  );
}

export function DreCard({ dre }: { dre: CLevel["dre"] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          DRE gerencial — junho 2026
        </h2>
        <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
          detalhar
        </button>
      </div>

      <div className="space-y-2">
        <Row label="Receita bruta (MRR)" value={dre.grossMRR} />
        <Row label="Deduções / Impostos" value={dre.deductions} negative />
        <Row label="Receita líquida" value={dre.netRevenue} strong />
        <div className="my-1 h-px bg-line" />
        <Row label="Salários & pró-labore" value={dre.salaries} negative />
        <Row label="Ferramentas & infra" value={dre.tools} negative />
        <Row label="Comissões comerciais" value={dre.commissions} negative />
        <div className="my-1 h-px bg-line" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Lucro líquido</span>
          <span className="text-lg font-bold tabular-nums text-emerald-400">
            {formatBRL(dre.netProfit)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Margem:{" "}
        <span className="font-medium text-ink">
          {dre.margin.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
        </span>{" "}
        · Meta: {dre.metaMargin}%
      </p>
    </Card>
  );
}
