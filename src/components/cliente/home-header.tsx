import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";

export function HomeHeader({
  clientName,
  periodLabel,
  pendingApprovals,
}: {
  clientName: string;
  periodLabel: string;
  pendingApprovals: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Olá, {clientName}
          <span className="ml-2 text-base font-normal text-muted">
            · {periodLabel}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizado há 2h
        </span>
        {pendingApprovals > 0 && (
          <Link
            href="/cliente/conteudo?status=scheduled"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/25 transition-colors hover:bg-emerald-500/25"
          >
            {pendingApprovals} pendentes
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
