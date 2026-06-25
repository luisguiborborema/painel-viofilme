import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";

export function ApprovalAlert({
  count,
  oldestDays,
}: {
  count: number;
  oldestDays: number;
}) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
          <Clock className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-200">
            {count} {count === 1 ? "post aguardando" : "posts aguardando"} sua
            aprovação
          </p>
          <p className="text-xs text-amber-200/70">
            {oldestDays > 0
              ? `O mais antigo está esperando há ${oldestDays} ${oldestDays === 1 ? "dia" : "dias"} — aprove para não atrasar o calendário`
              : "Aprove para não atrasar o calendário"}
          </p>
        </div>
      </div>
      <Link
        href="/cliente/conteudo?status=scheduled"
        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-300"
      >
        Ver aprovações
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
