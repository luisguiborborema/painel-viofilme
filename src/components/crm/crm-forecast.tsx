"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, Target, Ticket, X } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { isOpenLead, type CrmLeadCard, type Pipeline } from "@/lib/data/crm";

const DAY = 86_400_000;

export function CrmForecast({
  cards,
  pipelines = [],
  defaultPipelineId,
  currentUser = "",
}: {
  cards: CrmLeadCard[];
  pipelines?: Pipeline[];
  defaultPipelineId?: string;
  currentUser?: string;
}) {
  const [pipelineId, setPipelineId] = useState(defaultPipelineId ?? pipelines[0]?.id ?? "");
  const [mine, setMine] = useState(false);
  const [drill, setDrill] = useState<{ label: string; deals: CrmLeadCard[] } | null>(null);

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  const stages = useMemo(() => pipeline?.stages ?? [], [pipeline]);
  const probByKey = useMemo(() => new Map(stages.map((s) => [s.key, s.probability])), [stages]);

  const scoped = useMemo(
    () =>
      cards.filter(
        (c) =>
          (c.pipelineId || pipelineId) === pipelineId &&
          isOpenLead(c) &&
          (!mine || (c.assignees?.length ? c.assignees.includes(currentUser) : c.owner === currentUser)),
      ),
    [cards, pipelineId, mine, currentUser],
  );

  const prob = (c: CrmLeadCard) => probByKey.get(c.stage) ?? c.probability ?? 0;
  const weighted = (c: CrmLeadCard) => (c.monthlyValue * prob(c)) / 100;
  const bruto = scoped.reduce((s, c) => s + c.monthlyValue, 0);
  const ponderado = Math.round(scoped.reduce((s, c) => s + weighted(c), 0));
  const ticket = scoped.length ? Math.round(bruto / scoped.length) : 0;

  const perStage = useMemo(
    () =>
      stages
        .filter((s) => s.kind === "open")
        .map((s) => {
          const inS = scoped.filter((c) => c.stage === s.key);
          const b = inS.reduce((a, c) => a + c.monthlyValue, 0);
          return { key: s.key, label: s.label, color: s.color, count: inS.length, bruto: b, prob: s.probability, pond: Math.round((b * s.probability) / 100), deals: inS };
        }),
    [stages, scoped],
  );

  const now = new Date();
  // Mês de fechamento previsto: expected_close_at ou estimativa por etapa
  // (quanto menor a probabilidade, mais longe fecha).
  const closeKey = (c: CrmLeadCard) => {
    const d = c.expectedCloseAt
      ? new Date(c.expectedCloseAt)
      : new Date(now.getTime() + Math.round(((100 - prob(c)) / 100) * 60) * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) };
  });
  const byMonth = months.map((m) => {
    const inM = scoped.filter((c) => closeKey(c) === m.key);
    return { ...m, bruto: inM.reduce((a, c) => a + c.monthlyValue, 0), pond: Math.round(inM.reduce((a, c) => a + weighted(c), 0)), deals: inM };
  });
  const maxBar = Math.max(1, ...byMonth.map((x) => x.bruto));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {pipelines.length > 1 && (
          <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-400">
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {currentUser && (
          <button onClick={() => setMine((m) => !m)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", mine ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}>
            Meus negócios
          </button>
        )}
      </div>

      {/* Cards de topo (clicáveis → drill) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TopCard icon={TrendingUp} label="Pipeline aberto" value={formatBRL(bruto)} hint={`${scoped.length} negócios`} onClick={() => setDrill({ label: "Pipeline aberto", deals: scoped })} />
        <TopCard icon={Target} label="Previsão ponderada" value={formatBRL(ponderado)} hint="Σ valor × prob. da etapa" onClick={() => setDrill({ label: "Previsão ponderada", deals: scoped })} />
        <TopCard icon={Ticket} label="Ticket médio" value={formatBRL(ticket)} hint="por negócio aberto" onClick={() => setDrill({ label: "Todos os negócios", deals: scoped })} />
      </div>

      {/* Gráfico por mês de fechamento previsto */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Fechamento previsto por mês</h2>
        <p className="mb-4 text-xs text-muted">Barra clara = bruto · barra colorida = ponderado. Clique numa barra pra ver os negócios.</p>
        <div className="flex items-end gap-4">
          {byMonth.map((m) => {
            const brutoH = Math.round((m.bruto / maxBar) * 120);
            const pondH = Math.round((m.pond / maxBar) * 120);
            return (
              <button key={m.key} onClick={() => m.deals.length && setDrill({ label: `Fecham em ${m.label}`, deals: m.deals })} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-brand-600">{m.pond > 0 ? formatBRL(m.pond) : ""}</span>
                <div className="relative flex h-[124px] w-full items-end justify-center">
                  <div className="absolute bottom-0 w-8 rounded-t bg-subtle" style={{ height: `${brutoH}px` }} />
                  <div className="absolute bottom-0 w-8 rounded-t bg-brand-500" style={{ height: `${pondH}px` }} />
                </div>
                <span className="text-[11px] font-medium capitalize text-muted">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela por etapa (clicável → drill) */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-[1.6fr_0.6fr_1fr_0.6fr_1fr] gap-2 border-b border-line bg-canvas px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span>Etapa</span><span className="text-right">Nº</span><span className="text-right">Bruto</span><span className="text-right">Prob.</span><span className="text-right">Ponderado</span>
        </div>
        {perStage.map((s) => (
          <button key={s.key} onClick={() => s.deals.length && setDrill({ label: s.label, deals: s.deals })} className="grid w-full grid-cols-[1.6fr_0.6fr_1fr_0.6fr_1fr] items-center gap-2 border-b border-line px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-subtle/50">
            <span className="inline-flex items-center gap-1.5 text-ink"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}</span>
            <span className="text-right text-muted">{s.count}</span>
            <span className="text-right text-ink">{formatBRL(s.bruto)}</span>
            <span className="text-right text-muted">{s.prob}%</span>
            <span className="text-right font-semibold text-ink">{formatBRL(s.pond)}</span>
          </button>
        ))}
        <div className="grid grid-cols-[1.6fr_0.6fr_1fr_0.6fr_1fr] items-center gap-2 bg-canvas px-4 py-2.5 text-sm font-bold">
          <span className="text-ink">Total</span>
          <span className="text-right text-muted">{scoped.length}</span>
          <span className="text-right text-ink">{formatBRL(bruto)}</span>
          <span />
          <span className="text-right text-brand-600">{formatBRL(ponderado)}</span>
        </div>
      </div>

      {/* Drill-down: os negócios que sustentam o número clicado */}
      {drill && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrill(null)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-ink">{drill.label}</h2>
                <p className="text-[11px] text-muted">{drill.deals.length} negócio(s) · {formatBRL(drill.deals.reduce((s, c) => s + c.monthlyValue, 0))}</p>
              </div>
              <button onClick={() => setDrill(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {drill.deals.map((c) => (
                <Link key={c.id} href={`/gerencial/crm/${c.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-subtle">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-muted">{c.contactName ?? "—"} · {prob(c)}% prob.</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">{formatBRL(c.monthlyValue)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              ))}
              {drill.deals.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Sem negócios.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopCard({ icon: Icon, label, value, hint, onClick }: { icon: typeof Target; label: string; value: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:bg-subtle/50">
      <div className="flex items-center gap-2 text-muted"><Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </button>
  );
}
