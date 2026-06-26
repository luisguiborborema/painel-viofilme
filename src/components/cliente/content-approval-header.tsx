import { CalendarDays, ClipboardList, Plus } from "lucide-react";

export function ContentApprovalHeader({
  periodLabel,
  totalPosts,
}: {
  periodLabel: string;
  totalPosts: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Conteúdo &amp; aprovação
          </h1>
          <p className="text-sm text-muted">
            {periodLabel} · {totalPosts} posts no mês
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle">
          <CalendarDays className="h-4 w-4" /> Ver calendário
        </button>
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Solicitar conteúdo
        </button>
      </div>
    </div>
  );
}
