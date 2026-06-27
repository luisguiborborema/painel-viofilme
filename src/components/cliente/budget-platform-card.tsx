import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL, formatNumber } from "@/lib/utils";

function brl0(v: number) {
  return `R$ ${formatNumber(v)}`;
}

function PlatformBar({
  label,
  value,
  budget,
  color,
}: {
  label: string;
  value: number;
  budget: number;
  color: string;
}) {
  const width = Math.min(100, (value / budget) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
        <span className="font-semibold text-ink">{brl0(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-subtle-strong">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

const LABELS: Record<string, [string, string, string]> = {
  lead_gen: ["Leads", "CPL", "Conversões"],
  ecommerce: ["Pedidos", "CPA", "ROAS"],
  local_business: ["Alcance", "Cliques no mapa", "Ligações"],
};

function CompareRow({
  label,
  text,
  good,
}: {
  label: string;
  text: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium", good ? "text-emerald-400" : "text-rose-400")}>
        {text}
      </span>
    </div>
  );
}

export function BudgetPlatformCard({
  invested,
  budget,
  pct,
  daysRemaining,
  balance,
  dailyPace,
  metaInvested,
  googleInvested,
  clientType = "lead_gen",
  leadsDelta = 0,
  cplDelta = 0,
  convDelta = 0,
}: {
  invested: number;
  budget: number;
  pct: number;
  daysRemaining: number;
  balance: number;
  dailyPace: number;
  metaInvested: number;
  googleInvested: number;
  clientType?: "lead_gen" | "ecommerce" | "local_business";
  leadsDelta?: number;
  cplDelta?: number;
  convDelta?: number;
}) {
  const labels = LABELS[clientType];
  const daysToRunOut = dailyPace > 0 ? Math.floor(balance / dailyPace) : Infinity;
  const willRunOutEarly = daysToRunOut < daysRemaining - 5;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-ink">Orçamento por plataforma</h2>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink">
          {brl0(invested)}
        </span>
        <span className="text-sm text-muted">/ {brl0(budget)}</span>
      </div>
      <p className="text-xs text-muted">
        {pct}% consumido · {daysRemaining} dias restantes no mês
      </p>

      <div className="mt-4 space-y-3">
        <PlatformBar label="Meta Ads" value={metaInvested} budget={budget} color="#38bdf8" />
        <PlatformBar label="Google Ads" value={googleInvested} budget={budget} color="#34d399" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">Saldo restante</span>
        <span className="font-semibold text-ink">{brl0(balance)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Ritmo atual: {brl0(dailyPace)}/dia
      </p>

      {willRunOutEarly && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No ritmo atual, o orçamento esgota em ~{daysToRunOut} dias — antes do
          fim do mês.
        </p>
      )}

      {/* Comparativo com o mês anterior */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted">vs. mês anterior</p>
        <div className="space-y-1">
          <CompareRow
            label={labels[0]}
            text={`${leadsDelta >= 0 ? "+" : ""}${leadsDelta}%`}
            good={leadsDelta >= 0}
          />
          <CompareRow
            label={labels[1]}
            text={`${cplDelta >= 0 ? "+" : "-"}${formatBRL(Math.abs(cplDelta))}`}
            good={cplDelta < 0}
          />
          <CompareRow
            label={labels[2]}
            text={`${convDelta >= 0 ? "+" : ""}${convDelta}`}
            good={convDelta >= 0}
          />
        </div>
      </div>
    </Card>
  );
}
