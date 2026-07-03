import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  DollarSign,
  Percent,
  Ticket,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import type { BdrDashboard, FocusItem } from "@/lib/data/crm";

const FOCUS_STYLE: Record<
  FocusItem["kind"],
  { label: string; dot: string; chip: string }
> = {
  overdue: { label: "Ação crítica", dot: "bg-rose-500", chip: "bg-rose-500/15 text-rose-500" },
  today: { label: "Tarefas do dia", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-600" },
  "no-action": { label: "Sem próxima ação", dot: "bg-muted", chip: "bg-subtle text-muted" },
};

function FocusRow({ item }: { item: FocusItem }) {
  const st = FOCUS_STYLE[item.kind];
  const badge =
    item.kind === "overdue"
      ? `${item.daysLate}d atraso`
      : item.kind === "today"
        ? "Hoje"
        : "Sem ação";
  return (
    <Link
      href={`/gerencial/crm/${item.leadId}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-subtle"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-muted">{item.leadName}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
        {badge}
      </span>
    </Link>
  );
}

export function CrmDashboard({ d }: { d: BdrDashboard }) {
  const grouped = {
    overdue: d.focus.filter((f) => f.kind === "overdue"),
    today: d.focus.filter((f) => f.kind === "today"),
    "no-action": d.focus.filter((f) => f.kind === "no-action"),
  };
  const scorePct = Math.min(100, Math.round((d.score / d.scoreGoal) * 100));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="MRR novo no mês"
          value={formatBRL(d.newMrr)}
          icon={DollarSign}
          hint={`${d.wonCount} contrato(s)`}
        />
        <StatCard
          label="Pipeline em aberto"
          value={formatBRL(d.pipelineOpenValue)}
          icon={TrendingUp}
          hint={`ponderado ${formatBRL(d.pipelineWeighted)}`}
        />
        <StatCard
          label="Win rate"
          value={`${d.winRate}%`}
          icon={Percent}
          hint="ganhos ÷ fechados"
        />
        <StatCard
          label="Ticket médio"
          value={formatBRL(d.avgTicket)}
          icon={Ticket}
          hint="por contrato ganho"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lista de foco */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <AlarmClock className="h-[18px] w-[18px] text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">Lista de foco — hoje</h2>
          </div>
          {d.focus.length === 0 ? (
            <p className="rounded-xl bg-subtle px-3 py-6 text-center text-sm text-muted">
              Tudo em dia. Nenhuma ação pendente. 🎯
            </p>
          ) : (
            <div className="space-y-3">
              {(["overdue", "today", "no-action"] as const).map((kind) =>
                grouped[kind].length ? (
                  <div key={kind}>
                    <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {FOCUS_STYLE[kind].label} ({grouped[kind].length})
                    </p>
                    <div className="space-y-0.5">
                      {grouped[kind].map((f) => (
                        <FocusRow key={`${f.leadId}-${f.title}`} item={f} />
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </Card>

        {/* Coluna direita: pipeline por etapa + agenda + placar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Pipeline por etapa</h2>
            <div className="space-y-2.5">
              {d.byStage.map((s) => {
                const pct = d.pipelineOpenValue
                  ? Math.round((s.value / d.pipelineOpenValue) * 100)
                  : 0;
                return (
                  <div key={s.stage}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {s.label} ({s.count})
                      </span>
                      <span className="font-medium text-ink">{formatBRL(s.value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="bg-brand-700 p-5 text-white">
            <div className="flex items-center gap-2">
              <Trophy className="h-[18px] w-[18px] text-lime" />
              <h2 className="text-sm font-semibold">Placar do mês</h2>
            </div>
            <p className="mt-2 text-3xl font-bold">{d.score}</p>
            <p className="text-xs text-white/70">pontos acumulados</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-lime" style={{ width: `${scorePct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/70">
              {d.scoreGoal - d.score} pts para a meta ({d.scoreGoal})
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
