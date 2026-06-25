import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

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
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: color }}
          />
          {label}
        </span>
        <span className="font-semibold text-ink">{brl0(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
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
}: {
  invested: number;
  budget: number;
  pct: number;
  daysRemaining: number;
  balance: number;
  dailyPace: number;
  metaInvested: number;
  googleInvested: number;
}) {
  const projection =
    dailyPace * daysRemaining <= balance
      ? "projeção dentro do orçamento"
      : "projeção de estourar antes do fim do mês";

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
        <PlatformBar
          label="Meta Ads"
          value={metaInvested}
          budget={budget}
          color="#38bdf8"
        />
        <PlatformBar
          label="Google Ads"
          value={googleInvested}
          budget={budget}
          color="#34d399"
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">Saldo restante</span>
        <span className="font-semibold text-ink">{brl0(balance)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Ritmo atual: {brl0(dailyPace)}/dia · {projection}
      </p>
    </Card>
  );
}
