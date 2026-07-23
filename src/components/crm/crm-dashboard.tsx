"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRightLeft,
  CalendarCheck,
  CalendarClock,
  DollarSign,
  Flame,
  Megaphone,
  Pencil,
  PhoneCall,
  Percent,
  Quote,
  Snowflake,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import type {
  CommercialBoard,
  CommercialDash,
  FocusItem,
  InspirationQuote,
  LensMetric,
} from "@/lib/data/crm";

type AgendaEntry = { time: string; title: string; meetLink?: string };
type Lens = "prevenda" | "venda";

function fmtMetric(v: number, unit?: LensMetric["unit"]) {
  return unit === "brl" ? formatBRL(v) : unit === "pct" ? `${v}%` : String(v);
}

const FOCUS_STYLE: Record<FocusItem["kind"], { label: string; dot: string; chip: string }> = {
  overdue: { label: "Ação crítica", dot: "bg-rose-500", chip: "bg-rose-500/15 text-rose-500" },
  today: { label: "Tarefas do dia", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-600" },
  "no-action": { label: "Sem próxima ação", dot: "bg-muted", chip: "bg-subtle text-muted" },
};

export function CrmDashboard({
  dash,
  agenda = [],
  proximaReuniao,
  board,
  quote,
  currentUser = "",
  commercialRole = "gestor",
  canEditMural = false,
}: {
  dash: CommercialDash;
  agenda?: AgendaEntry[];
  proximaReuniao?: { title: string; iso?: string; meetLink?: string };
  board: CommercialBoard;
  quote?: InspirationQuote | null;
  currentUser?: string;
  commercialRole?: string;
  canEditMural?: boolean;
}) {
  const isGestor = commercialRole === "gestor" || commercialRole === "" || !commercialRole;
  const locked: Lens | null = commercialRole === "sdr" ? "prevenda" : commercialRole === "closer" ? "venda" : null;
  const [lens, setLens] = useState<Lens>(locked ?? "venda");
  const d = dash.base;
  const mes = dash.mes;
  const lensMetrics = lens === "prevenda" ? dash.prevenda : dash.venda;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + lente */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Olá, <span className="font-semibold text-ink">{currentUser || "time"}</span> — sua central comercial.
        </p>
        {isGestor && !locked ? (
          <div className="inline-flex rounded-xl border border-line p-0.5">
            {(["prevenda", "venda"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setLens(k)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", lens === k ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")}
              >
                {k === "prevenda" ? "Pré-venda" : "Venda"}
              </button>
            ))}
          </div>
        ) : (
          <span className="rounded-full bg-subtle px-3 py-1 text-xs font-semibold text-muted">
            Lente {lens === "prevenda" ? "Pré-venda" : "Venda"}
          </span>
        )}
      </div>

      {/* KPIs de resultado (transparentes a todos) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR novo no mês" value={formatBRL(d.newMrr)} icon={DollarSign} hint={`${d.wonCount} contrato(s)`} />
        <StatCard label="Pipeline em aberto" value={formatBRL(d.pipelineOpenValue)} icon={TrendingUp} hint={`ponderado ${formatBRL(d.pipelineWeighted)}`} />
        <StatCard label="Win rate" value={`${d.winRate}%`} icon={Percent} hint="ganhos ÷ fechados" />
        <StatCard label="Ticket médio" value={formatBRL(d.avgTicket)} icon={Ticket} hint="por contrato ganho" />
      </div>

      {/* Cockpit da pré-venda */}
      {lens === "prevenda" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat icon={PhoneCall} label="A contactar" value={d.toContact} tone="rose" />
          <MiniStat icon={Zap} label="Cadências ativas" value={d.cadencesActive} tone="amber" />
          <MiniStat icon={CalendarCheck} label="Reuniões agendadas" value={d.meetingsScheduled} tone="brand" />
          <MiniStat icon={Users} label="No-shows" value={d.noShowsOpen} tone="rose" />
          <MiniStat icon={ArrowRightLeft} label="Bastões pendentes" value={d.handoffsPending} tone="brand" />
          <MiniStat icon={Snowflake} label="Congelados" value={d.frozenCount} tone="sky" />
        </div>
      )}

      {/* Ontem / Hoje / Mês */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ONTEM */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Como foi ontem</h2>
          <div className="divide-y divide-line">
            {dash.ontem.map((m) => <MetricRow key={m.key} m={m} />)}
          </div>
        </Card>

        {/* HOJE */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Como vai ser hoje</h2>
          <div className="mb-3 flex items-center justify-between rounded-xl bg-canvas px-3 py-2">
            <span className="text-sm text-muted">Tarefas a fazer hoje</span>
            <span className="flex items-baseline gap-2"><span className="text-lg font-bold text-ink">{dash.hojeTasks}</span><span className="text-[11px] text-muted">time {dash.hojeTeamTasks}</span></span>
          </div>
          {d.focus.length === 0 ? (
            <p className="rounded-xl bg-subtle px-3 py-4 text-center text-xs text-muted">Nenhuma call hoje ainda. Bora começar! 🎯</p>
          ) : (
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {d.focus.slice(0, 6).map((f) => <FocusRow key={`${f.leadId}-${f.title}`} item={f} />)}
            </div>
          )}
        </Card>

        {/* MÊS */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Como vai o mês</h2>
            <ProjBadge status={mes.projStatus} hasMeta={mes.hasMeta} />
          </div>
          {mes.hasMeta ? (
            <>
              <MrrBar realizado={mes.mrrRealizado} meta={mes.mrrMeta} ritmo={mes.mrrRitmo} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat mini label="Realizado" value={formatBRL(mes.mrrRealizado)} />
                <Stat mini label="Meta" value={formatBRL(mes.mrrMeta)} />
                <Stat mini label="Projeção" value={formatBRL(mes.projecao)} />
                <Stat mini label="Falta" value={formatBRL(mes.faltaMrr)} />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {mes.atingimento}% da meta · dia útil {mes.workdaysElapsed}/{mes.workdaysTotal} · ritmo necessário {formatBRL(mes.mrrRitmo)}
              </p>
            </>
          ) : (
            <div className="rounded-xl bg-subtle px-3 py-4 text-center">
              <p className="text-sm font-semibold text-ink">{formatBRL(mes.mrrRealizado)} realizado</p>
              <p className="mt-0.5 text-xs text-muted">Defina sua meta na aba Metas para ver ritmo e projeção.</p>
            </div>
          )}
          {mes.esforcoFalta.length > 0 && (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
              Esforço: {mes.esforcoFalta.some((e) => e.falta > 0)
                ? mes.esforcoFalta.filter((e) => e.falta > 0).map((e) => `faltam ${e.falta} ${e.label}`).join(" · ")
                : "metas de atividade batidas 🎯"}
            </p>
          )}
          <p className="mt-2 border-t border-line pt-2 text-[11px] text-muted">
            Time: {formatBRL(mes.teamRealizado)}{mes.teamMeta > 0 ? ` de ${formatBRL(mes.teamMeta)}` : ""}
          </p>
        </Card>
      </div>

      {/* Lente: métricas eu vs time + termômetro */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {lens === "prevenda" ? "Esforço (pré-venda)" : "Resultado (venda)"} — eu vs. time
          </h2>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {lensMetrics.map((m) => <MetricRow key={m.key} m={m} />)}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Flame className="h-[18px] w-[18px] text-rose-500" /> Termômetro de leads</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Thermo label="Quentes" value={dash.termometro.hot} chip="bg-rose-500/15 text-rose-600" />
              <Thermo label="Mornos" value={dash.termometro.warm} chip="bg-amber-500/15 text-amber-600" />
              <Thermo label="Frios" value={dash.termometro.cold} chip="bg-subtle text-muted" />
            </div>
          </Card>

          {/* Placar */}
          <Card className="bg-brand-700 p-5 text-white">
            <div className="flex items-center gap-2"><Trophy className="h-[18px] w-[18px] text-lime" /><h2 className="text-sm font-semibold">Placar do mês</h2></div>
            <p className="mt-2 text-3xl font-bold">{d.score}</p>
            <p className="text-xs text-white/70">pontos acumulados</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-lime" style={{ width: `${Math.min(100, Math.round((d.score / d.scoreGoal) * 100))}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/70">{d.scoreGoal - d.score} pts para a meta ({d.scoreGoal})</p>
          </Card>
        </div>
      </div>

      {/* Agenda + Pipeline por etapa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2"><CalendarClock className="h-[18px] w-[18px] text-brand-600" /><h2 className="text-sm font-semibold text-ink">Agenda de hoje</h2></div>
          {agenda.length === 0 ? (
            <p className="rounded-lg bg-subtle px-3 py-4 text-center text-xs text-muted">Sem compromissos. Conecte o Google Agenda em Integrações.</p>
          ) : (
            <div className="space-y-2">
              {agenda.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-12 shrink-0 text-xs font-semibold text-muted">{a.time}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.title}</span>
                  {a.meetLink && <a href={a.meetLink} target="_blank" rel="noreferrer" className="shrink-0 text-emerald-600 hover:text-emerald-700"><Video className="h-4 w-4" /></a>}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">Pipeline por etapa</h2>
          {d.byStage.length === 0 ? (
            <p className="text-sm text-muted">Sem negócios em aberto.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {d.byStage.map((s) => {
                const pct = d.pipelineOpenValue ? Math.round((s.value / d.pipelineOpenValue) * 100) : 0;
                return (
                  <div key={s.stage}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">{s.label} ({s.count})</span><span className="font-medium text-ink">{formatBRL(s.value)}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recepção (rodapé acolhedor) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><AlarmClock className="h-[18px] w-[18px] text-amber-500" /> Próxima tarefa</h2>
          {dash.proximaTarefa ? (
            <Link href={`/gerencial/crm/${dash.proximaTarefa.leadId}`} className="block rounded-xl bg-canvas px-3 py-2.5 hover:bg-subtle">
              <p className="text-sm font-medium text-ink">{dash.proximaTarefa.title}</p>
              <p className="text-xs text-muted">{dash.proximaTarefa.dueIso ? `${dayMonth(dash.proximaTarefa.dueIso)} ${clockLabel(dash.proximaTarefa.dueIso)}` : "sem data"}</p>
            </Link>
          ) : <p className="text-sm text-muted">Nada pendente. 🎉</p>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><CalendarCheck className="h-[18px] w-[18px] text-brand-600" /> Próxima reunião</h2>
          {proximaReuniao ? (
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-sm font-medium text-ink">{proximaReuniao.title}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{proximaReuniao.iso ? `${dayMonth(proximaReuniao.iso)} ${clockLabel(proximaReuniao.iso)}` : ""}</p>
                {proximaReuniao.meetLink && <a href={proximaReuniao.meetLink} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700"><Video className="h-4 w-4" /></a>}
              </div>
            </div>
          ) : <p className="text-sm text-muted">Sem reuniões próximas.</p>}
        </Card>

        <Mural board={board} quote={quote} canEdit={canEditMural} />
      </div>
    </div>
  );
}

/* ── Sub-componentes ───────────────────────────────────── */

function MetricRow({ m }: { m: LensMetric }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted">{m.label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-base font-bold text-ink">{fmtMetric(m.mine, m.unit)}</span>
        <span className="text-[11px] text-muted">time {fmtMetric(m.team, m.unit)}</span>
      </span>
    </div>
  );
}

function Stat({ label, value, mini }: { label: string; value: string; mini?: boolean }) {
  return (
    <div className={cn("rounded-lg bg-canvas px-2.5 py-1.5", mini && "px-2 py-1")}>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Thermo({ label, value, chip }: { label: string; value: number; chip: string }) {
  return (
    <div className={cn("rounded-xl py-3", chip)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] font-medium">{label}</p>
    </div>
  );
}

function ProjBadge({ status, hasMeta }: { status: "verde" | "ambar" | "vermelho"; hasMeta: boolean }) {
  if (!hasMeta) return <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted">sem meta</span>;
  const map = {
    verde: { label: "Vai bater", cls: "bg-emerald-500/15 text-emerald-600" },
    ambar: { label: "No limite", cls: "bg-amber-500/15 text-amber-600" },
    vermelho: { label: "Fora do ritmo", cls: "bg-rose-500/15 text-rose-600" },
  }[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", map.cls)}>{map.label}</span>;
}

function MrrBar({ realizado, meta, ritmo }: { realizado: number; meta: number; ritmo: number }) {
  const pct = meta ? Math.min(100, Math.round((realizado / meta) * 100)) : 0;
  const pacePct = meta ? Math.min(100, Math.round((ritmo / meta) * 100)) : 0;
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      {/* marcador do ritmo necessário */}
      <div className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${pacePct}%` }} title="Ritmo necessário" />
    </div>
  );
}

function Mural({ board, quote, canEdit }: { board: CommercialBoard; quote?: InspirationQuote | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(board.message);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch("/api/crm/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) }).catch(() => {});
    setBusy(false);
    setEditing(false);
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink"><Megaphone className="h-[18px] w-[18px] text-brand-600" /> Mural do time</h2>
        {canEdit && !editing && (
          <button onClick={() => { setMsg(board.message); setEditing(true); }} className="text-muted hover:text-ink" title="Editar mural"><Pencil className="h-4 w-4" /></button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-subtle">Cancelar</button>
            <button onClick={save} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">Salvar</button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-ink">{board.message || "—"}</p>
      )}
      {quote && (
        <div className="mt-auto border-t border-line pt-3">
          <p className="inline-flex items-start gap-1.5 text-xs italic text-muted"><Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {quote.text}</p>
          {quote.source && <p className="mt-0.5 pl-5 text-[11px] text-muted">— {quote.source}</p>}
        </div>
      )}
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof PhoneCall; label: string; value: number; tone?: "neutral" | "amber" | "rose" | "sky" | "brand" }) {
  const tones: Record<string, string> = { neutral: "text-muted", amber: "text-amber-600", rose: "text-rose-500", sky: "text-sky-600", brand: "text-brand-600" };
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle", tones[tone])}><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0"><p className="text-lg font-bold leading-none text-ink">{value}</p><p className="truncate text-[11px] text-muted">{label}</p></div>
    </Card>
  );
}

function FocusRow({ item }: { item: FocusItem }) {
  const st = FOCUS_STYLE[item.kind];
  const badge = item.kind === "overdue" ? `${item.daysLate}d atraso` : item.kind === "today" ? "Hoje" : "Sem ação";
  return (
    <Link href={`/gerencial/crm/${item.leadId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-subtle">
      <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.title}</p><p className="truncate text-xs text-muted">{item.leadName}</p></div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>{badge}</span>
    </Link>
  );
}
