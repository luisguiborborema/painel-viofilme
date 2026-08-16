"use client";

import { useState } from "react";
import { Activity, Award, Eye, Sparkles, TrendingUp, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL, formatCompact } from "@/lib/utils";
import {
  CLIENT_TYPE_LABEL,
  LENSES,
  metricMeta,
  formatGoalValue,
  type ClientHealth,
  type FormatRow,
  type Lens,
  type SocialRow,
  type SpecialtyRow,
  type TrafficRow,
} from "@/lib/data/gestao-vista";

export type GavData = {
  lenses: Lens[];
  nominal: boolean;
  ownName?: string;
  periodLabel: string;
  health: ClientHealth[];
  traffic: { rows: TrafficRow[]; average: { metaHit?: number; avgCpl: number; avgCtr: number } };
  social: { rows: SocialRow[]; average: { engagementRate: number; commentRate: number; followersGrowth: number } };
  specialty: SpecialtyRow[];
  formats: FormatRow[];
  aggregate: { revenue: number; conversions: number; spend: number; activeClients: number };
};

const STATUS: Record<ClientHealth["status"], { label: string; chip: string; dot: string }> = {
  healthy: { label: "Saudável", chip: "bg-emerald-500/15 text-emerald-600", dot: "bg-emerald-500" },
  risk: { label: "Em risco", chip: "bg-rose-500/15 text-rose-500", dot: "bg-rose-500" },
  "no-goal": { label: "Sem meta", chip: "bg-subtle text-muted", dot: "bg-muted" },
};

export function GestaoVista(props: GavData) {
  const [lens, setLens] = useState<Lens>(props.lenses[0]);
  const active = props.lenses.includes(lens) ? lens : props.lenses[0];

  return (
    <div className="space-y-4">
      {/* Seletor de lente + aviso leitura-apenas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {LENSES.filter((l) => props.lenses.includes(l.key)).map((l) => (
            <button
              key={l.key}
              onClick={() => setLens(l.key)}
              title={l.hint}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                active === l.key ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs text-muted">
          <Eye className="h-3.5 w-3.5" /> Leitura · {props.periodLabel}
        </span>
      </div>

      {active === "trafego" && <TrafegoLens {...props} />}
      {active === "social" && <SocialLens {...props} />}
      {active === "lideranca" && <LiderancaLens {...props} />}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

// ── Lente Tráfego ────────────────────────────────────────────────────────────

function TrafegoLens({ health, traffic, nominal, ownName }: GavData) {
  const healthy = health.filter((h) => h.status === "healthy").length;
  const risk = health.filter((h) => h.status === "risk").length;
  const noGoal = health.filter((h) => h.status === "no-goal").length;
  const rows = nominal ? traffic.rows : traffic.rows.filter((r) => r.name === ownName);

  return (
    <div className="space-y-4">
      {/* Termômetro da carteira */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Contas saudáveis" value={String(healthy)} sub="acima da meta" />
        <Metric label="Contas em risco" value={String(risk)} sub="exigem otimização" />
        <Metric label="Sem meta cadastrada" value={String(noGoal)} sub="defina em Clientes → Metas" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-[18px] w-[18px] text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">Termômetro da carteira</h2>
        </div>
        <div className="space-y-1.5">
          {health.map((h) => {
            const st = STATUS[h.status];
            const m = metricMeta(h.metric);
            return (
              <div key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                  <p className="text-xs text-muted">
                    {CLIENT_TYPE_LABEL[h.clientType]} · {m.label}: {formatGoalValue(h.actual, m.unit)}
                    {h.target != null && ` / meta ${formatGoalValue(h.target, m.unit)}`}
                  </p>
                </div>
                {h.attainment != null && (
                  <span className="shrink-0 text-xs font-semibold text-ink">
                    {Math.round(h.attainment * 100)}%
                  </span>
                )}
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.chip)}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Impacto individual — eficiência (ranking) + absoluto (contexto) */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Award className="h-[18px] w-[18px] text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">Impacto por gestor</h2>
        </div>
        <p className="mb-3 text-xs text-muted">
          Ranking por <strong className="text-ink">eficiência</strong> (% da meta batida). Absoluto é contexto — não ranqueia.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Gestor</th>
                <th className="py-2 pr-2 text-right">% meta</th>
                <th className="py-2 pr-2 text-right">CPL méd.</th>
                <th className="py-2 pr-2 text-right">CTR méd.</th>
                <th className="py-2 pr-2 text-right text-muted">Conversões</th>
                <th className="py-2 text-right text-muted">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.name}
                  className={cn(
                    "border-b border-line/60",
                    r.name === ownName && "bg-brand-50/50",
                  )}
                >
                  <td className="py-2.5 pr-2 text-muted">{nominal ? i + 1 : "—"}</td>
                  <td className="py-2.5 pr-2 font-medium text-ink">
                    {nominal || r.name === ownName ? r.name : "—"}
                    {r.name === ownName && <span className="ml-1 text-[10px] text-brand-600">(você)</span>}
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    {r.metaHit != null ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                        {Math.round(r.metaHit)}%
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-ink">{formatBRL(r.avgCpl)}</td>
                  <td className="py-2.5 pr-2 text-right text-ink">{r.avgCtr.toFixed(1)}%</td>
                  <td className="py-2.5 pr-2 text-right text-muted">{formatCompact(r.conversions)}</td>
                  <td className="py-2.5 text-right text-muted">{formatBRL(r.revenue)}</td>
                </tr>
              ))}
              {!nominal && (
                <tr className="text-xs text-muted">
                  <td />
                  <td className="py-2.5 font-medium">Média do time</td>
                  <td className="py-2.5 text-right">
                    {traffic.average.metaHit != null ? `${Math.round(traffic.average.metaHit)}%` : "—"}
                  </td>
                  <td className="py-2.5 text-right">{formatBRL(traffic.average.avgCpl)}</td>
                  <td className="py-2.5 text-right">{traffic.average.avgCtr.toFixed(1)}%</td>
                  <td /><td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!nominal && (
          <p className="mt-3 text-xs text-muted">
            Você vê o seu desempenho comparado à média do time — sem ranking nominal dos colegas.
          </p>
        )}
      </Card>
    </div>
  );
}

// ── Lente Social ─────────────────────────────────────────────────────────────

function SocialLens({ social, nominal, ownName }: GavData) {
  const rows = nominal ? social.rows : social.rows.filter((r) => r.name === ownName);
  const avg = social.average;

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp className="h-[18px] w-[18px] text-brand-600" />
        <h2 className="text-sm font-semibold text-ink">Resultados por analista</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        Engajamento, taxa de comentários e crescimento de seguidores na carteira.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 pr-2">Analista</th>
              <th className="py-2 pr-2 text-right">Engajamento</th>
              <th className="py-2 pr-2 text-right">Taxa coment.</th>
              <th className="py-2 pr-2 text-right">Novos seguidores</th>
              <th className="py-2 text-right text-muted">Interações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={cn("border-b border-line/60", r.name === ownName && "bg-brand-50/50")}>
                <td className="py-2.5 pr-2 font-medium text-ink">
                  {nominal || r.name === ownName ? r.name : "—"}
                  {r.name === ownName && <span className="ml-1 text-[10px] text-brand-600">(você)</span>}
                </td>
                <td className="py-2.5 pr-2 text-right text-ink">{r.engagementRate.toFixed(1)}%</td>
                <td className="py-2.5 pr-2 text-right text-ink">{r.commentRate.toFixed(1)}%</td>
                <td className="py-2.5 pr-2 text-right text-ink">+{formatCompact(r.followersGrowth)}</td>
                <td className="py-2.5 text-right text-muted">{formatCompact(r.engagement)}</td>
              </tr>
            ))}
            <tr className="text-xs text-muted">
              <td className="py-2.5 font-medium">Média do time</td>
              <td className="py-2.5 text-right">{avg.engagementRate.toFixed(1)}%</td>
              <td className="py-2.5 text-right">{avg.commentRate.toFixed(1)}%</td>
              <td className="py-2.5 text-right">+{formatCompact(avg.followersGrowth)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {!nominal && (
        <p className="mt-3 text-xs text-muted">
          Benchmarking do seu desempenho vs. média do time — sem nomes dos colegas.
        </p>
      )}
    </Card>
  );
}

// ── Lente Liderança ──────────────────────────────────────────────────────────

function LiderancaLens({ specialty, formats, aggregate }: GavData) {
  const maxFormat = Math.max(1, ...formats.map((f) => f.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Faturamento gerado" value={formatBRL(aggregate.revenue)} sub="para os clientes (Meta)" />
        <Metric label="Conversões" value={formatCompact(aggregate.conversions)} sub="no período" />
        <Metric label="Investimento" value={formatBRL(aggregate.spend)} sub="mídia gerida" />
        <Metric label="Clientes ativos" value={String(aggregate.activeClients)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-[18px] w-[18px] text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">Vocação por segmento (performance)</h2>
          </div>
          <div className="space-y-2.5">
            {specialty.map((s) => (
              <div key={s.type}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {CLIENT_TYPE_LABEL[s.type]} ({s.total})
                  </span>
                  <span className="font-semibold text-ink">{s.successRate}% de sucesso</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.successRate}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            % de contas com meta batida em cada tipo de cliente.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users2 className="h-[18px] w-[18px] text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">Vocação por formato (conteúdo)</h2>
          </div>
          <div className="space-y-2.5">
            {formats.map((f) => (
              <div key={f.format}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">{f.format}</span>
                  <span className="font-semibold text-ink">{f.count} conta(s)</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(f.count / maxFormat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Formato dominante na carteira de cada tipo.</p>
        </Card>
      </div>
    </div>
  );
}
