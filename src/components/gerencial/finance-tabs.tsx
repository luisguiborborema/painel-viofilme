"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  MessageSquare,
  Phone,
  Plus,
  Receipt,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { MediaMetricCard } from "@/components/cliente/media-metric-card";
import { MultiBarChart } from "@/components/dashboard/charts";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import type { GerFinance, Receivable } from "@/lib/data/gerfinance";

type TabKey = "visao" | "receber" | "pagar" | "inadimplencia" | "dre";
type RecFilter = "todas" | "avencer" | "vencida" | "pago";

const TABS: { key: TabKey; label: string }[] = [
  { key: "visao", label: "Visão geral" },
  { key: "receber", label: "Contas a receber" },
  { key: "pagar", label: "Contas a pagar" },
  { key: "inadimplencia", label: "Inadimplência" },
  { key: "dre", label: "DRE gerencial" },
];

const STATUS_TONE = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-rose-300",
  info: "text-sky-300",
};

function brl0(v: number) {
  return `R$ ${formatNumber(v)}`;
}

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function FinanceTabs({ data }: { data: GerFinance }) {
  const [tab, setTab] = useState<TabKey>("visao");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-brand-500 text-white"
                : "bg-subtle text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "visao" && <VisaoGeral data={data} />}
      {tab === "receber" && <ContasReceber data={data} />}
      {tab === "pagar" && <ContasPagar />}
      {tab === "inadimplencia" && <Inadimplencia data={data} />}
      {tab === "dre" && <Dre data={data} />}
    </div>
  );
}

/* ---------------------------------- Visão geral ---------------------------- */

function VisaoGeral({ data }: { data: GerFinance }) {
  const k = data.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MediaMetricCard
          label="MRR (receita recorrente)"
          value={brl0(k.mrr)}
          deltaText={k.mrrDelta}
          tone="good"
          deltaDirection="up"
        />
        <MediaMetricCard
          label="Previsto próximos 30d"
          value={brl0(k.forecast30)}
          hint={k.forecastNote}
        />
        <MediaMetricCard
          label="Inadimplência em aberto"
          value={brl0(k.overdue)}
          deltaText={k.overdueNote}
          tone="bad"
          deltaDirection="down"
        />
        <MediaMetricCard
          label="Margem operacional"
          value={`${k.margin}%`}
          deltaText={k.marginDelta}
          tone="good"
          deltaDirection="up"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              Projeção de caixa — próximos 90 dias
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <Legend color="#34d399" label="Entradas" />
              <Legend color="#fb7185" label="Saídas" />
              <Legend color="#38bdf8" label="Saldo" />
            </div>
          </div>
          <MultiBarChart
            data={data.cashflow}
            categoryKey="month"
            currency
            height={240}
            series={[
              { key: "entradas", color: "#34d399", name: "Entradas" },
              { key: "saidas", color: "#fb7185", name: "Saídas" },
              { key: "saldo", color: "#38bdf8", name: "Saldo" },
            ]}
          />
          <p className="mt-2 text-xs text-muted">{data.cashflowNote}</p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Composição da receita — junho
          </h2>
          <p className="text-2xl font-bold text-ink">
            MRR {data.revenue.mrrPct}%
          </p>
          <div className="mt-4 space-y-3">
            <CompRow label="MRR" value={data.revenue.mrr} total={data.dre.grossRevenue} color="#2a63c9" />
            <CompRow label="Projetos pontuais" value={data.revenue.projetos} total={data.dre.grossRevenue} color="#38bdf8" />
            <CompRow label="Outros" value={data.revenue.outros} total={data.dre.grossRevenue} color="#94a3b8" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Status de recebimento — junho
          </h2>
          <ul className="space-y-2.5">
            <StatusRow label="Recebido no mês" value={data.receiptStatus.received} tone="text-emerald-400" />
            <StatusRow label="A vencer (próx. 7d)" value={data.receiptStatus.dueSoon} tone="text-amber-400" />
            <StatusRow label="Vencido em aberto" value={data.receiptStatus.overdue} tone="text-rose-400" />
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Inadimplência crítica
            </h2>
            <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
              ver todas
            </button>
          </div>
          <ul className="space-y-2">
            {data.critical.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-subtle p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.name} · {brl0(c.value)}
                  </p>
                  <p className="truncate text-xs text-rose-400">{c.note}</p>
                </div>
                <ActionButton action={c.action === "cs" ? "cs" : "whatsapp"} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Total inadimplente:{" "}
            <span className="font-semibold text-ink">
              {brl0(data.delinquencyTotal)}
            </span>
          </p>
        </Card>
      </div>

      {/* Régua de cobrança */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Régua de cobrança automática
          </h2>
          <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
            configurar
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.rule.map((r, i) => (
            <div key={r.stage} className="rounded-xl border border-line bg-subtle p-4">
              <span
                className={cn(
                  "text-sm font-bold",
                  ["text-emerald-300", "text-amber-300", "text-orange-300", "text-rose-300"][i],
                )}
              >
                {r.stage}
              </span>
              <p className="mt-1 text-sm font-medium text-ink">{r.title}</p>
              <p className="mt-1 text-xs text-muted">{r.desc}</p>
              <span className="mt-2 inline-block rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">
                {r.tag}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function CompRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-ink">{brl0(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-subtle-strong">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / total) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone)}>{brl0(value)}</span>
    </li>
  );
}

/* ------------------------------- Contas a receber -------------------------- */

function ActionButton({
  action,
}: {
  action: Receivable["action"];
}) {
  if (action === "download")
    return (
      <button
        className="inline-flex items-center justify-center rounded-lg border border-line bg-subtle p-2 text-muted hover:text-ink"
        aria-label="Baixar comprovante"
      >
        <Download className="h-4 w-4" />
      </button>
    );
  if (action === "pix")
    return (
      <button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400">
        PIX
      </button>
    );
  if (action === "whatsapp")
    return (
      <button className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25">
        <Phone className="h-3.5 w-3.5" /> WhatsApp
      </button>
    );
  return (
    <button className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/25">
      Acionar CS
    </button>
  );
}

const REC_TABS: { key: RecFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "avencer", label: "A vencer" },
  { key: "vencida", label: "Vencidas" },
  { key: "pago", label: "Pagas" },
];

function ContasReceber({ data }: { data: GerFinance }) {
  const [filter, setFilter] = useState<RecFilter>("todas");
  const rows = useMemo(
    () =>
      filter === "todas"
        ? data.receivables
        : data.receivables.filter((r) => r.statusKey === filter),
    [data.receivables, filter],
  );

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Contas a receber — junho / julho 2026
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {REC_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === t.key
                  ? "bg-brand-500 text-white"
                  : "bg-subtle text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Régua</th>
              <th className="px-4 py-3 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-subtle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-[11px] font-bold text-brand-300">
                      {initials(r.client)}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{r.client}</p>
                      <p className="text-xs text-muted">{r.segment}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{r.description}</td>
                <td className="px-4 py-3 text-ink">{r.dueLabel}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatBRL(r.value)}
                </td>
                <td className={cn("px-4 py-3 font-medium", STATUS_TONE[r.status.tone])}>
                  {r.status.label}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{r.ruler}</td>
                <td className="px-4 py-3 text-right">
                  <ActionButton action={r.action} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  Nenhuma fatura nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {data.receivablesTotals.count} faturas · Total recebido:{" "}
          <span className="font-semibold text-emerald-400">
            {brl0(data.receivablesTotals.received)}
          </span>{" "}
          · Em aberto:{" "}
          <span className="font-semibold text-rose-400">
            {brl0(data.receivablesTotals.open)}
          </span>
        </span>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle-strong">
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
      </div>
    </Card>
  );
}

/* -------------------------------- Contas a pagar --------------------------- */

function ContasPagar() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle text-muted">
        <Receipt className="h-6 w-6" />
      </span>
      <p className="text-sm text-muted">
        Salários, ferramentas, impostos e fornecedores.
      </p>
      <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
        <Plus className="h-4 w-4" /> Lançar despesa
      </button>
    </Card>
  );
}

/* -------------------------------- Inadimplência ---------------------------- */

function Inadimplencia({ data }: { data: GerFinance }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-rose-100">
              {brl0(data.delinquencyTotal)} em inadimplência — 2 clientes precisam de intervenção
            </p>
            <p className="mt-0.5 text-xs text-ink/70">
              Academia FitBody está em D+12 — escalonamento para CS recomendado imediatamente
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/15">
          Notificar equipe
        </button>
      </div>

      <Card className="p-5">
        <ul className="space-y-2">
          {data.critical.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-subtle p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                <p className="truncate text-xs text-rose-400">
                  {c.note} · {brl0(c.value)}
                </p>
              </div>
              <ActionButton action={c.action === "cs" ? "cs" : "whatsapp"} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-sm text-muted">
          Lista completa de inadimplentes com histórico de cobranças, próximas
          ações e responsável CS.
        </p>
        <div className="mt-3 flex justify-center">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-4 py-2 text-sm font-medium text-ink hover:bg-subtle-strong">
            Ver relatório completo <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------- DRE ----------------------------------- */

function DreRow({
  label,
  value,
  negative = false,
  strong = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium text-ink" : "text-muted"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          negative ? "text-rose-400" : strong ? "font-semibold text-ink" : "text-ink",
        )}
      >
        {negative ? "− " : ""}
        {formatBRL(value)}
      </span>
    </div>
  );
}

function Dre({ data }: { data: GerFinance }) {
  const d = data.dre;
  const maxExp = Math.max(...data.topExpenses.map((e) => e.value), 1);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            DRE gerencial — junho 2026
          </h2>
          <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
            detalhar
          </button>
        </div>
        <div className="space-y-2">
          <DreRow label="Receita bruta (MRR + projetos)" value={d.grossRevenue} />
          <DreRow label={`Impostos e deduções (-${d.taxPct}%)`} value={d.taxes} negative />
          <DreRow label="Receita líquida" value={d.netRevenue} strong />
          <div className="my-1 h-px bg-line" />
          <DreRow label="Salários & pró-labore" value={d.salaries} negative />
          <DreRow label="Ferramentas & infraestrutura" value={d.tools} negative />
          <DreRow label="Comissões comerciais" value={d.commissions} negative />
          <DreRow label="Custos operacionais variáveis" value={d.variableCosts} negative />
          <div className="my-1 h-px bg-line" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Lucro líquido</span>
            <span className="text-lg font-bold tabular-nums text-emerald-400">
              {formatBRL(d.netProfit)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Margem:{" "}
          <span className="font-semibold text-emerald-400">
            {d.margin.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
          </span>{" "}
          · vs. meta {d.metaMargin}% ·{" "}
          <span className="text-emerald-400">Acima da meta</span>
        </p>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Principais despesas
          </h2>
          <ul className="space-y-2.5">
            {data.topExpenses.map((e) => (
              <li key={e.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{e.label}</span>
                  <span className="font-medium text-ink">{brl0(e.value)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                  <div
                    className="h-full rounded-full bg-brand-400"
                    style={{ width: `${(e.value / maxExp) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Margem por cliente
          </h2>
          <ul className="space-y-2.5">
            {data.marginByClient.map((m) => (
              <li key={m.name} className="flex items-center gap-3">
                <span className="w-36 truncate text-sm text-ink">{m.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      m.pct >= 45 ? "bg-emerald-400" : m.pct >= 35 ? "bg-amber-400" : "bg-rose-400",
                    )}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-ink">
                  {m.pct}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
