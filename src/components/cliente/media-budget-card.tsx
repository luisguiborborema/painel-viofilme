import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

function brl0(v: number) {
  return `R$ ${formatNumber(v)}`;
}

export function MediaBudgetCard({
  invested,
  total,
  pct,
  leads,
  conversions,
  daysRemaining,
  balance,
}: {
  invested: number;
  total: number;
  pct: number;
  leads: number;
  conversions: number;
  daysRemaining: number;
  balance: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Orçamento de mídia</h2>
        <Link
          href="/cliente/campanhas"
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          Campanhas <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight text-ink">
          {brl0(invested)}
        </p>
        <p className="text-sm text-muted">investido de {brl0(total)}</p>
      </div>

      {/* Barra de progresso com marcador */}
      <div className="mt-5">
        <div className="relative mb-1.5 h-4 text-[11px] text-muted">
          <span className="absolute left-0">0%</span>
          <span
            className="absolute -translate-x-1/2 font-semibold text-ink"
            style={{ left: `${clamped}%` }}
          >
            {clamped}%
          </span>
          <span className="absolute right-0">100%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle-strong">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {daysRemaining} dias restantes no mês · saldo {brl0(balance)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/cliente/campanhas?view=leads"
          className="group rounded-xl bg-subtle p-3 transition-colors hover:bg-subtle-strong"
        >
          <p className="flex items-center gap-1 text-xl font-bold text-ink">
            {formatNumber(leads)}
            <ArrowUpRight className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </p>
          <p className="text-xs text-muted">Leads gerados</p>
        </Link>
        <Link
          href="/cliente/campanhas?view=conversions"
          className="group rounded-xl bg-subtle p-3 transition-colors hover:bg-subtle-strong"
        >
          <p className="flex items-center gap-1 text-xl font-bold text-ink">
            {formatNumber(conversions)}
            <ArrowUpRight className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </p>
          <p className="text-xs text-muted">Conversões</p>
        </Link>
      </div>
    </Card>
  );
}
