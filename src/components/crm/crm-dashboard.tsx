import Link from "next/link";
import {
  AlarmClock,
  ArrowRightLeft,
  CalendarCheck,
  CalendarClock,
  DollarSign,
  PhoneCall,
  Percent,
  Snowflake,
  Ticket,
  TrendingUp,
  Trophy,
  UserX,
  Video,
  Zap,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import type { BdrDashboard, FocusItem } from "@/lib/data/crm";

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof PhoneCall;
  label: string;
  value: number;
  tone?: "neutral" | "amber" | "rose" | "sky" | "brand";
}) {
  const tones: Record<string, string> = {
    neutral: "text-muted",
    amber: "text-amber-600",
    rose: "text-rose-500",
    sky: "text-sky-600",
    brand: "text-brand-600",
  };
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle", tones[tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none text-ink">{value}</p>
        <p className="truncate text-[11px] text-muted">{label}</p>
      </div>
    </Card>
  );
}

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

type AgendaEntry = { time: string; title: string; meetLink?: string };

export function CrmDashboard({
  d,
  agenda = [],
}: {
  d: BdrDashboard;
  agenda?: AgendaEntry[];
}) {
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

      {/* Cockpit da pré-venda (SDR) — cadeia de funis */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Cockpit da pré-venda</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat icon={PhoneCall} label="A contactar" value={d.toContact} tone="rose" />
          <MiniStat icon={Zap} label="Cadências ativas" value={d.cadencesActive} tone="amber" />
          <MiniStat icon={CalendarCheck} label="Reuniões agendadas" value={d.meetingsScheduled} tone="brand" />
          <MiniStat icon={UserX} label="No-shows" value={d.noShowsOpen} tone="rose" />
          <MiniStat icon={ArrowRightLeft} label="Bastões pendentes" value={d.handoffsPending} tone="brand" />
          <MiniStat icon={Snowflake} label="Congelados" value={d.frozenCount} tone="sky" />
        </div>
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

        {/* Coluna direita: agenda + pipeline por etapa + placar */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-[18px] w-[18px] text-brand-600" />
              <h2 className="text-sm font-semibold text-ink">Agenda de hoje</h2>
            </div>
            {agenda.length === 0 ? (
              <p className="rounded-lg bg-subtle px-3 py-4 text-center text-xs text-muted">
                Sem compromissos. Conecte o Google Agenda em Integrações.
              </p>
            ) : (
              <div className="space-y-2">
                {agenda.map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-12 shrink-0 text-xs font-semibold text-muted">{a.time}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.title}</span>
                    {a.meetLink && (
                      <a
                        href={a.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-emerald-600 hover:text-emerald-700"
                        title="Entrar no Meet"
                      >
                        <Video className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

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
