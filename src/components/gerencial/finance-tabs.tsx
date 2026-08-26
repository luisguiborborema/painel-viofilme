"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Download,
  Loader2,
  Phone,
  Plus,
  Receipt,
  Landmark,
  Pencil,
  Repeat,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { MediaMetricCard } from "@/components/cliente/media-metric-card";
import { MultiBarChart } from "@/components/dashboard/charts";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import {
  EXPENSE_CATEGORY_LABEL,
  type Expense,
  type GerFinance,
  type Receivable,
} from "@/lib/data/gerfinance";
import { RECURRENCES, planejarParcelas, type Recurrence } from "@/lib/data/expense-series";
import { variacao, type DrePeriodo, type DreResultado } from "@/lib/data/dre";
import { DRE_GROUPS, type DreGroup, type ExpenseCategoryDef } from "@/lib/data/expense-categories";
import { COLLECTION_ACTIONS, type CollectionAction, type FinanceSettings } from "@/lib/data/finance-settings";
import { Extrato, FluxoDeCaixa, RentabilidadeClientes } from "./finance-extras";
import {
  ACCOUNT_KINDS,
  MANUAL_METHODS,
  type AccountTransfer,
  type FinancialAccount,
} from "@/lib/data/gerfinance";

type TabKey = "visao" | "fluxo" | "receber" | "pagar" | "extrato" | "contas" | "rentabilidade" | "config" | "inadimplencia" | "dre";
type RecFilter = "todas" | "avencer" | "vencida" | "pago";

const TABS: { key: TabKey; label: string }[] = [
  { key: "visao", label: "Visão geral" },
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "receber", label: "Contas a receber" },
  { key: "pagar", label: "Contas a pagar" },
  { key: "extrato", label: "Extrato" },
  { key: "contas", label: "Contas & categorias" },
  { key: "config", label: "Configurações" },
  { key: "inadimplencia", label: "Inadimplência" },
  { key: "rentabilidade", label: "Rentabilidade" },
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
      <div data-tour="fin-tabs" className="flex flex-wrap gap-2">
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
      {tab === "pagar" && <ContasPagar data={data} />}
      {tab === "fluxo" && <FluxoDeCaixa />}
      {tab === "extrato" && <Extrato contas={data.accounts ?? []} />}
      {tab === "rentabilidade" && <RentabilidadeClientes />}
      {tab === "contas" && <ContasFinanceiras data={data} />}
      {tab === "config" && <ConfiguracoesFinanceiro />}
      {tab === "inadimplencia" && <Inadimplencia data={data} />}
      {tab === "dre" && <Dre />}
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
            Composição da receita — {data.periodLabel}
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
            Status de recebimento — {data.periodLabel}
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
            {data.critical.length === 0 && (
              <li className="rounded-xl bg-subtle p-3 text-sm text-muted">
                Nenhum cliente inadimplente.
              </li>
            )}
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
  const router = useRouter();
  const [filter, setFilter] = useState<RecFilter>("todas");
  const [novoManual, setNovoManual] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function actManual(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    await fetch("/api/gerencial/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusyId(null);
    router.refresh();
  }
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
          Contas a receber — {data.periodLabel}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setNovoManual((v) => !v)}
            className="mr-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {novoManual ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Lançar recebimento
          </button>
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

      {novoManual && (
        <ReceivableForm
          accounts={data.accounts ?? []}
          onClose={() => setNovoManual(false)}
          onSaved={() => { setNovoManual(false); router.refresh(); }}
        />
      )}

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
                <td className="px-4 py-3 text-muted">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.description}
                    {r.source === "manual" && (
                      <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">manual</span>
                    )}
                    {r.accountName && (
                      <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">{r.accountName}</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">{r.dueLabel}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatBRL(r.value)}
                </td>
                <td className={cn("px-4 py-3 font-medium", STATUS_TONE[r.status.tone])}>
                  {r.status.label}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{r.ruler}</td>
                <td className="px-4 py-3 text-right">
                  {r.source === "manual" && r.rowId ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {r.statusKey === "pago" ? (
                        <button
                          onClick={() => actManual({ action: "unreceive", id: r.rowId }, r.rowId!)}
                          disabled={busyId === r.rowId}
                          className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-muted hover:text-ink disabled:opacity-60"
                          title="Estornar recebimento"
                        >
                          {busyId === r.rowId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => actManual({ action: "receive", id: r.rowId }, r.rowId!)}
                          disabled={busyId === r.rowId}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/25 disabled:opacity-60"
                        >
                          {busyId === r.rowId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Recebi
                        </button>
                      )}
                      <button
                        onClick={() => { if (window.confirm(`Excluir "${r.description}"?`)) actManual({ action: "delete", id: r.rowId }, r.rowId!); }}
                        disabled={busyId === r.rowId}
                        className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-muted hover:text-rose-500 disabled:opacity-60"
                        aria-label="Excluir lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <ActionButton action={r.action} />
                  )}
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

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y.slice(2)}` : iso;
}

async function postExpense(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/gerencial/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Sem conexão com o servidor." };
  const j = await res.json().catch(() => null);
  return { ok: res.ok, error: res.ok ? undefined : (j?.error ?? "Não foi possível salvar.") };
}

/** Rótulo da categoria pela chave gravada; cai no próprio código se foi removida. */
function rotuloCategoria(cats: ExpenseCategoryDef[] | undefined, key: string): string {
  return (cats ?? []).find((c) => c.key === key)?.label ?? EXPENSE_CATEGORY_LABEL[key as Expense["category"]] ?? key;
}

function ContasPagar({ data }: { data: GerFinance }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Expense | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const expenses = data.expenses;
  const totalPending = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);

  async function act(body: { action: "pay" | "unpay" | "delete"; id: string; scope?: "one" | "future" }) {
    setBusyId(body.id);
    await postExpense(body);
    setBusyId(null);
    router.refresh();
  }

  /** Excluir: numa série, oferece apagar só a parcela ou as futuras em aberto. */
  function excluir(e: Expense) {
    if (e.seriesId) {
      const futuras = window.confirm(
        `"${e.description}" faz parte de uma recorrência.\n\n` +
          "OK = apagar esta e as PRÓXIMAS ainda não pagas\n" +
          "Cancelar = apagar só esta parcela",
      );
      act({ action: "delete", id: e.id, scope: futuras ? "future" : "one" });
      return;
    }
    if (window.confirm(`Excluir "${e.description}"?`)) act({ action: "delete", id: e.id });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted">
            A pagar:{" "}
            <span className="font-semibold text-rose-400">{brl0(totalPending)}</span>
          </span>
          <span className="text-muted">
            Já pago:{" "}
            <span className="font-semibold text-emerald-400">{brl0(totalPaid)}</span>
          </span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Lançar despesa
        </button>
      </div>

      {(showForm || editando) && (
        <ExpenseForm
          key={editando?.id ?? "novo"}
          editar={editando}
          categorias={data.categories ?? []}
          clientes={data.clients ?? []}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      {expenses.length === 0 && !showForm ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle text-muted">
            <Receipt className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted">
            Nenhuma despesa lançada. Salários, ferramentas, impostos e fornecedores
            entram aqui e alimentam o DRE.
          </p>
        </Card>
      ) : expenses.length > 0 ? (
        <Card className="p-0">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Despesa</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-subtle">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{e.description}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {e.vendor ? <span>{e.vendor}</span> : null}
                        {e.seriesId ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-1.5 py-0.5 font-medium text-brand-600">
                            <Repeat className="h-3 w-3" />
                            {e.installment && e.installmentsTotal
                              ? `${e.installment}/${e.installmentsTotal}`
                              : "recorrente"}
                          </span>
                        ) : (
                          <span>avulsa</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{rotuloCategoria(data.categories, e.category)}</td>
                    <td className="px-4 py-3 text-ink">{fmtDay(e.dueDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatBRL(e.amount)}</td>
                    <td className="px-4 py-3">
                      {e.status === "paid" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                          Paga{e.paidDate ? ` · ${fmtDay(e.paidDate)}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                          A pagar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.status === "pending" ? (
                          <button
                            onClick={() => act({ action: "pay", id: e.id })}
                            disabled={busyId === e.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
                          >
                            {busyId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Pagar
                          </button>
                        ) : (
                          <button
                            onClick={() => act({ action: "unpay", id: e.id })}
                            disabled={busyId === e.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
                            title="Estornar"
                          >
                            {busyId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => { setEditando(e); setShowForm(false); }}
                          disabled={busyId === e.id}
                          className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-muted hover:text-ink disabled:opacity-60"
                          aria-label="Editar despesa"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => excluir(e)}
                          disabled={busyId === e.id}
                          className="inline-flex items-center justify-center rounded-lg border border-line p-1.5 text-muted hover:text-rose-300 disabled:opacity-60"
                          aria-label="Excluir despesa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

const NEW_EXPENSE = {
  clientId: "",
  description: "",
  category: "outros" as Expense["category"],
  amount: "",
  dueDate: "",
  vendor: "",
  status: "pending" as Expense["status"],
  /** "unica" | "parcelada" (nº fixo) | "aberta" (sem fim) */
  repeticao: "unica" as "unica" | "parcelada" | "aberta",
  recorrencia: "monthly" as Recurrence,
  parcelas: "12",
};

function ExpenseForm({
  onClose,
  onSaved,
  editar,
  categorias,
  clientes,
}: {
  onClose: () => void;
  onSaved: () => void;
  /** Quando presente, o formulário edita esta despesa em vez de criar. */
  editar?: Expense | null;
  categorias: ExpenseCategoryDef[];
  clientes: { id: string; name: string }[];
}) {
  const emSerie = Boolean(editar?.seriesId);
  const [f, setF] = useState(() =>
    editar
      ? {
          ...NEW_EXPENSE,
          clientId: editar.clientId ?? "",
          description: editar.description,
          category: editar.category,
          amount: String(editar.amount).replace(".", ","),
          dueDate: editar.dueDate ?? "",
          vendor: editar.vendor ?? "",
          status: editar.status,
        }
      : NEW_EXPENSE,
  );
  const [escopo, setEscopo] = useState<"one" | "future">("one");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amountNum = Number(f.amount.replace(",", "."));
  const valid = f.description.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0;

  // Prévia dos vencimentos — evita surpresa em fim de mês (31/jan → 28/fev).
  const previa =
    !editar && f.repeticao !== "unica" && f.dueDate
      ? planejarParcelas(f.dueDate, f.recorrencia, f.repeticao === "aberta" ? 3 : Number(f.parcelas) || 1)
      : [];
  const totalParcelas = f.repeticao === "parcelada" ? Math.max(1, Number(f.parcelas) || 1) : 0;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    const r = editar
      ? await postExpense({
          action: "update",
          id: editar.id,
          scope: emSerie ? escopo : "one",
          description: f.description.trim(),
          category: f.category,
          amount: amountNum,
          dueDate: f.dueDate || undefined,
          vendor: f.vendor.trim() || undefined,
          clientId: f.clientId || null,
        })
      : await postExpense({
          action: "create",
          description: f.description.trim(),
          category: f.category,
          amount: amountNum,
          dueDate: f.dueDate || undefined,
          vendor: f.vendor.trim() || undefined,
          clientId: f.clientId || null,
          status: f.status,
          ...(f.repeticao === "unica"
            ? {}
            : {
                recurrence: f.recorrencia,
                openEnded: f.repeticao === "aberta",
                installments: f.repeticao === "parcelada" ? Number(f.parcelas) || 1 : undefined,
              }),
        });
    setBusy(false);
    if (r.ok) onSaved();
    else setErr(r.error ?? "Não foi possível salvar.");
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{editar ? "Editar despesa" : "Nova despesa"}</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Descrição *</span>
          <input
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder="Ex.: Folha de pagamento"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Categoria</span>
          <select
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value as Expense["category"] })}
            className={inputCls}
          >
            {categorias.filter((c) => c.active).map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Valor (R$) *</span>
          <input
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
            inputMode="decimal"
            placeholder="0,00"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">
            {editar || f.repeticao === "unica" ? "Vencimento" : "1º vencimento"}
          </span>
          <input
            type="date"
            value={f.dueDate}
            onChange={(e) => setF({ ...f, dueDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Fornecedor</span>
          <input
            value={f.vendor}
            onChange={(e) => setF({ ...f, vendor: e.target.value })}
            placeholder="Opcional"
            className={inputCls}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Cliente (custo direto)</span>
          <select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} className={inputCls}>
            <option value="">— custo de estrutura (sem cliente) —</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="mt-0.5 block text-[10px] text-muted">
            Vincular faz esta despesa entrar na rentabilidade daquele cliente.
          </span>
        </label>

        {/* Recorrência — só na criação; editar série usa o seletor de escopo. */}
        {!editar && (
          <div className="sm:col-span-2">
            <span className="mb-1 block text-[11px] font-medium text-muted">Repetição</span>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ["unica", "Única"],
                ["parcelada", "Parcelada"],
                ["aberta", "Sem fim"],
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setF({ ...f, repeticao: k })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    f.repeticao === k ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {lbl}
                </button>
              ))}
              {f.repeticao !== "unica" && (
                <select
                  value={f.recorrencia}
                  onChange={(e) => setF({ ...f, recorrencia: e.target.value as Recurrence })}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400"
                >
                  {RECURRENCES.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              )}
              {f.repeticao === "parcelada" && (
                <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <input
                    value={f.parcelas}
                    onChange={(e) => setF({ ...f, parcelas: e.target.value })}
                    inputMode="numeric"
                    className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-center text-xs text-ink outline-none focus:border-brand-400"
                  />
                  parcelas
                </label>
              )}
            </div>
            {f.repeticao !== "unica" && (
              <p className="mt-1.5 text-[11px] text-muted">
                {f.repeticao === "aberta"
                  ? "Sem data final: o sistema mantém 12 meses de contas geradas à frente."
                  : `Cria ${totalParcelas} conta(s), uma por vencimento.`}
                {previa.length > 0 && (
                  <>
                    {" "}Começa em {previa.map((x) => ddmmFromIso(x.dueDate)).join(" · ")}
                    {f.repeticao === "aberta" ? "…" : totalParcelas > 3 ? "…" : ""}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Editar parcela de uma série: alcance da alteração */}
        {editar && emSerie && (
          <div className="sm:col-span-2 rounded-lg bg-subtle p-2.5">
            <span className="mb-1 block text-[11px] font-medium text-muted">Aplicar em</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["one", "Só esta parcela"],
                ["future", "Esta e as próximas (não pagas)"],
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEscopo(k)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    escopo === k ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {escopo === "future" && (
              <p className="mt-1.5 text-[11px] text-muted">
                O vencimento não é propagado — cada parcela mantém a data dela.
              </p>
            )}
          </div>
        )}

        {!editar && (
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={f.status === "paid"}
                disabled={f.repeticao !== "unica"}
                onChange={(e) => setF({ ...f, status: e.target.checked ? "paid" : "pending" })}
                className="h-4 w-4 rounded border-line disabled:opacity-40"
              />
              Já paga
            </label>
            {f.repeticao !== "unica" && (
              <span className="text-[11px] text-muted">Parcelas nascem em aberto; baixe uma a uma.</span>
            )}
          </div>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editar ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editar ? "Salvar" : "Lançar"}
        </button>
      </div>
    </div>
  );
}

/** dd/mm a partir de uma data ISO (para a prévia das parcelas). */
function ddmmFromIso(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/* --------------------------- Recebimento manual ---------------------------- */

const NOVO_RECEBIVEL = {
  description: "",
  value: "",
  dueDate: "",
  method: "PIX",
  accountId: "",
  note: "",
  status: "pending" as "pending" | "received",
  parcelas: "1",
  recorrencia: "monthly" as Recurrence,
};

/** Lançamento de entrada fora do Asaas (PIX, dinheiro, permuta…). */
function ReceivableForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: FinancialAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const padrao = accounts.find((a) => a.isDefault) ?? accounts[0];
  const [f, setF] = useState({ ...NOVO_RECEBIVEL, accountId: padrao?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valorNum = Number(f.value.replace(",", "."));
  const valid = f.description.trim().length > 0 && Number.isFinite(valorNum) && valorNum > 0;
  const nParcelas = Math.max(1, Number(f.parcelas) || 1);

  async function salvar() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/gerencial/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        description: f.description.trim(),
        value: valorNum,
        dueDate: f.dueDate || undefined,
        method: f.method,
        accountId: f.accountId || undefined,
        note: f.note.trim() || undefined,
        status: f.status === "received" ? "received" : undefined,
        installments: nParcelas,
        recurrence: f.recorrencia,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) onSaved();
    else setErr(j?.error ?? "Não foi possível lançar.");
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="mb-3 rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Lançar recebimento (fora do Asaas)</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Descrição *</span>
          <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Projeto de site — entrada" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Valor (R$) *</span>
          <input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} inputMode="decimal" placeholder="0,00" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">{nParcelas > 1 ? "1º vencimento" : "Vencimento"}</span>
          <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Forma</span>
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={inputCls}>
            {MANUAL_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Conta</span>
          <select value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })} className={inputCls}>
            <option value="">— sem conta —</option>
            {accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Parcelas</span>
          <input value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })} inputMode="numeric" className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Observação</span>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Opcional" className={inputCls} />
        </label>
        <div className="flex items-center sm:col-span-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={f.status === "received"}
              disabled={nParcelas > 1}
              onChange={(e) => setF({ ...f, status: e.target.checked ? "received" : "pending" })}
              className="h-4 w-4 rounded border-line disabled:opacity-40"
            />
            Já recebido
          </label>
          {nParcelas > 1 && (
            <span className="ml-3 text-[11px] text-muted">
              {nParcelas} parcelas mensais de {formatBRL(valorNum || 0)} — todas em aberto.
            </span>
          )}
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
      {accounts.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-600">
          Nenhuma conta cadastrada — o lançamento funciona, mas não entra em nenhum saldo. Crie em &quot;Contas &amp; saldos&quot;.
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">Cancelar</button>
        <button onClick={salvar} disabled={!valid || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Lançar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Contas & saldos ----------------------------- */

async function postAccount(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/gerencial/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Sem conexão com o servidor." };
  const j = await res.json().catch(() => null);
  return { ok: res.ok, error: res.ok ? undefined : (j?.error ?? "Não foi possível salvar.") };
}

const NOVA_CONTA = { name: "", kind: "banco" as FinancialAccount["kind"], institution: "", openingBalance: "" };

function ContasFinanceiras({ data }: { data: GerFinance }) {
  const router = useRouter();
  const [form, setForm] = useState(NOVA_CONTA);
  const [editId, setEditId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const contas = data.accounts ?? [];
  const saldoTotal = contas.filter((c) => c.active).reduce((s, c) => s + (c.balance ?? 0), 0);

  async function salvar() {
    if (!form.name.trim()) { setErr("Informe o nome da conta."); return; }
    setBusy("save");
    setErr(null);
    const r = await postAccount({
      action: editId ? "update" : "create",
      id: editId ?? undefined,
      name: form.name.trim(),
      kind: form.kind,
      institution: form.institution.trim() || undefined,
      openingBalance: Number(form.openingBalance.replace(",", ".")) || 0,
    });
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "Falha ao salvar."); return; }
    setForm(NOVA_CONTA); setEditId(null); setAberto(false);
    router.refresh();
  }

  async function acao(body: Record<string, unknown>, id: string) {
    setBusy(id);
    const r = await postAccount(body);
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "Falha."); return; }
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  if (contas.length === 0 && !aberto) {
    return (
      <Card className="p-8 text-center">
        <Landmark className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-2 text-sm font-semibold text-ink">Nenhuma conta cadastrada</p>
        <p className="mt-1 text-xs text-muted">
          Cadastre suas contas (Asaas, BTG, Inter, caixa…) para acompanhar o saldo de cada uma e
          dizer por onde cada recebimento e pagamento passou.
        </p>
        <button
          onClick={() => setAberto(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova conta
        </button>
        {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          Saldo somado:{" "}
          <span className={cn("font-semibold", saldoTotal >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {formatBRL(saldoTotal)}
          </span>
        </span>
        <button
          onClick={() => { setAberto(true); setEditId(null); setForm(NOVA_CONTA); }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova conta
        </button>
      </div>

      {aberto && (
        <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{editId ? "Editar conta" : "Nova conta"}</p>
            <button onClick={() => { setAberto(false); setEditId(null); setForm(NOVA_CONTA); }} className="rounded-lg p-1 text-muted hover:bg-subtle">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Nome *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Inter · PJ" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Tipo</span>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FinancialAccount["kind"] })} className={inputCls}>
                {ACCOUNT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Saldo inicial (R$)</span>
              <input value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </label>
          </div>
          {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setAberto(false); setEditId(null); }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">Cancelar</button>
            <button onClick={salvar} disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {contas.map((c) => (
          <Card key={c.id} className={cn("p-4", !c.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                  <Landmark className="h-3.5 w-3.5 text-muted" /> {c.name}
                  {c.isDefault && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">padrão</span>}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  {ACCOUNT_KINDS.find((k) => k.key === c.kind)?.label ?? c.kind}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <button
                  onClick={() => {
                    setEditId(c.id); setAberto(true);
                    setForm({ name: c.name, kind: c.kind, institution: c.institution ?? "", openingBalance: String(c.openingBalance ?? 0).replace(".", ",") });
                  }}
                  className="rounded-lg p-1.5 text-muted hover:text-ink" title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Excluir a conta "${c.name}"? Os lançamentos ficam, só perdem o vínculo.`)) acao({ action: "delete", id: c.id }, c.id); }}
                  disabled={busy === c.id}
                  className="rounded-lg p-1.5 text-muted hover:text-rose-500 disabled:opacity-50" title="Excluir"
                >
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <p className={cn("mt-3 text-2xl font-bold", (c.balance ?? 0) >= 0 ? "text-ink" : "text-rose-500")}>
              {formatBRL(c.balance ?? 0)}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
              <span>inicial {formatBRL(c.openingBalance)}</span>
              <span className="text-emerald-500">+{formatBRL(c.received ?? 0)}</span>
              <span className="text-rose-500">−{formatBRL(c.paid ?? 0)}</span>
              {(c.transferIn ?? 0) > 0 && <span className="text-sky-500">↓{formatBRL(c.transferIn ?? 0)}</span>}
              {(c.transferOut ?? 0) > 0 && <span className="text-sky-500">↑{formatBRL(c.transferOut ?? 0)}</span>}
            </div>
            {!c.isDefault && (
              <button
                onClick={() => acao({ action: "update", id: c.id, isDefault: true }, c.id)}
                className="mt-2 text-[11px] font-medium text-muted hover:text-brand-600"
              >
                Tornar padrão
              </button>
            )}
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        O saldo é <strong>inicial + recebido − pago</strong>, contando só o que já foi liquidado. Lançamentos em aberto não entram.
      </p>

      <Transferencias contas={contas} transfers={data.transfers ?? []} />

      <CategoriasDespesa categorias={data.categories ?? []} />
    </div>
  );
}

/* --------------------------- Transferências --------------------------------- */

/** Move saldo entre contas sem virar receita nem despesa (não entra no DRE). */
function Transferencias({ contas, transfers }: { contas: FinancialAccount[]; transfers: AccountTransfer[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const ativas = contas.filter((c) => c.active);
  const [f, setF] = useState({ from: "", to: "", amount: "", date: "", note: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const valorNum = Number(f.amount.replace(",", "."));
  const valid = f.from && f.to && f.from !== f.to && Number.isFinite(valorNum) && valorNum > 0;
  const origem = ativas.find((c) => c.id === f.from);
  const saldoInsuficiente = origem && valorNum > (origem.balance ?? 0);

  async function enviar(body: Record<string, unknown>, chave: string) {
    setBusy(chave); setErro(null);
    const res = await fetch("/api/gerencial/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return false; }
    router.refresh();
    return true;
  }

  const inputCls = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Transferências entre contas</h2>
          <p className="text-[11px] text-muted">Move saldo de uma conta para outra. Não é receita nem despesa — não entra no DRE.</p>
        </div>
        <button
          onClick={() => setAberto((v) => !v)}
          disabled={ativas.length < 2}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          title={ativas.length < 2 ? "Cadastre pelo menos duas contas" : undefined}
        >
          {aberto ? <X className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />} Transferir
        </button>
      </div>

      {ativas.length < 2 && (
        <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-[11px] text-muted">
          É preciso ter ao menos duas contas ativas para transferir.
        </p>
      )}

      {aberto && ativas.length >= 2 && (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-brand-400/40 bg-brand-50/40 p-3 sm:grid-cols-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">De</span>
            <select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inputCls + " w-full"}>
              <option value="">—</option>
              {ativas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Para</span>
            <select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inputCls + " w-full"}>
              <option value="">—</option>
              {ativas.filter((c) => c.id !== f.from).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Valor (R$)</span>
            <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} inputMode="decimal" placeholder="0,00" className={inputCls + " w-full"} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Data</span>
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls + " w-full"} />
          </label>
          <div className="flex items-end">
            <button
              onClick={async () => {
                if (await enviar({ action: "create", fromAccount: f.from, toAccount: f.to, amount: valorNum, date: f.date || undefined, note: f.note || undefined }, "novo")) {
                  setF({ from: "", to: "", amount: "", date: "", note: "" });
                  setAberto(false);
                }
              }}
              disabled={!valid || busy === "novo"}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy === "novo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Transferir
            </button>
          </div>
          {saldoInsuficiente && (
            <p className="text-[11px] text-amber-600 sm:col-span-5">
              Atenção: {origem?.name} tem {formatBRL(origem?.balance ?? 0)} — a transferência deixará o saldo negativo.
            </p>
          )}
          {erro && <p className="text-[11px] text-rose-500 sm:col-span-5">{erro}</p>}
        </div>
      )}

      {transfers.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {transfers.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink">
                {t.fromName} <span className="text-muted">→</span> {t.toName}
                {t.note && <span className="ml-1 text-[11px] text-muted">· {t.note}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-ink">{formatBRL(t.amount)}</span>
              <span className="w-20 shrink-0 text-right text-[11px] text-muted">{fmtDay(t.date)}</span>
              <button
                onClick={() => { if (window.confirm("Excluir esta transferência? Os saldos voltam ao que eram.")) enviar({ action: "delete", id: t.id }, t.id); }}
                disabled={busy === t.id}
                className="shrink-0 rounded-lg p-1 text-muted hover:text-rose-500 disabled:opacity-50"
                aria-label="Excluir transferência"
              >
                {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------- Configurações do Financeiro ------------------------ */

/** Régua de cobrança, formas de recebimento e alertas. */
function ConfiguracoesFinanceiro() {
  const [cfg, setCfg] = useState<FinanceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gerencial/finance-settings")
      .then((r) => r.json())
      .then((j: FinanceSettings) => setCfg(j))
      .catch(() => {});
  }, []);

  async function salvar(patch: Partial<FinanceSettings>) {
    setBusy(true); setErro(null); setMsg(null);
    const res = await fetch("/api/gerencial/finance-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return; }
    setMsg("Salvo.");
    setTimeout(() => setMsg(null), 2000);
  }

  if (!cfg) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const inputCls = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="space-y-4">
      {/* Régua de cobrança */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Régua de cobrança</h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          O que fazer conforme o atraso cresce. A fatura vencida mostra o degrau alcançado na aba
          Contas a receber; o mais avançado vence.
        </p>
        <div className="space-y-1.5">
          {cfg.collectionRules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-2.5 py-2">
              <span className="text-xs text-muted">a partir de</span>
              <input
                value={r.days}
                onChange={(e) => {
                  const v = [...cfg.collectionRules];
                  v[i] = { ...r, days: Math.max(0, Number(e.target.value) || 0) };
                  setCfg({ ...cfg, collectionRules: v });
                }}
                inputMode="numeric"
                className={inputCls + " w-14 text-center"}
              />
              <span className="text-xs text-muted">dias</span>
              <input
                value={r.label}
                onChange={(e) => {
                  const v = [...cfg.collectionRules];
                  v[i] = { ...r, label: e.target.value };
                  setCfg({ ...cfg, collectionRules: v });
                }}
                placeholder="O que acontece"
                className={inputCls + " min-w-0 flex-1"}
              />
              <select
                value={r.action}
                onChange={(e) => {
                  const v = [...cfg.collectionRules];
                  v[i] = { ...r, action: e.target.value as CollectionAction };
                  setCfg({ ...cfg, collectionRules: v });
                }}
                className={inputCls + " text-xs"}
              >
                {COLLECTION_ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <button
                onClick={() => setCfg({ ...cfg, collectionRules: cfg.collectionRules.filter((_, k) => k !== i) })}
                className="rounded-lg p-1.5 text-muted hover:text-rose-500"
                aria-label="Remover degrau"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setCfg({ ...cfg, collectionRules: [...cfg.collectionRules, { days: 30, label: "Novo passo", action: "whatsapp" }] })}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle"
          >
            <Plus className="h-3.5 w-3.5" /> Degrau
          </button>
          <button
            onClick={() => salvar({ collectionRules: cfg.collectionRules })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar régua
          </button>
        </div>
      </Card>

      {/* Formas de recebimento */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Formas de recebimento</h2>
        <p className="mb-3 mt-1 text-[11px] text-muted">Opções do lançamento manual em Contas a receber.</p>
        <div className="flex flex-wrap gap-1.5">
          {cfg.paymentMethods.map((m, i) => (
            <span key={m.key} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
              {m.label}
              <button
                onClick={() => setCfg({ ...cfg, paymentMethods: cfg.paymentMethods.filter((_, k) => k !== i) })}
                className="text-muted hover:text-rose-500"
                aria-label={`Remover ${m.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="nova-forma"
            placeholder="Ex.: Boleto à vista"
            className={inputCls + " min-w-0 flex-1"}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const el = e.currentTarget;
              const label = el.value.trim();
              if (!label) return;
              setCfg({ ...cfg, paymentMethods: [...cfg.paymentMethods, { key: label.toUpperCase(), label }] });
              el.value = "";
            }}
          />
          <button
            onClick={() => salvar({ paymentMethods: cfg.paymentMethods })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar formas
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted">Digite e pressione Enter para adicionar.</p>
      </Card>

      {/* Alertas */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Alertas no WhatsApp</h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          Enviados uma vez por dia, na rotina da manhã, para os números internos configurados
          (<code className="rounded bg-subtle px-1">UAZAPI_NOTIFY_NUMBERS</code>).
        </p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={cfg.alertMargin}
            onChange={(e) => { const v = e.target.checked; setCfg({ ...cfg, alertMargin: v }); salvar({ alertMargin: v }); }}
            className="h-4 w-4 rounded border-line"
          />
          Avisar quando a margem do mês ficar abaixo da meta ({cfg.metaMargin}%)
        </label>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-ink">
          <span>Avisar quando a inadimplência passar de</span>
          <input
            value={cfg.alertOverdue || ""}
            onChange={(e) => setCfg({ ...cfg, alertOverdue: Number(e.target.value.replace(",", ".")) || 0 })}
            inputMode="decimal"
            placeholder="0"
            className={inputCls + " w-28"}
          />
          <span className="text-muted">R$ (0 = desligado)</span>
          <button
            onClick={() => salvar({ alertOverdue: cfg.alertOverdue })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </Card>

      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      {erro && <p className="text-xs text-rose-500">{erro}</p>}
    </div>
  );
}

/* --------------------------- Categorias de despesa -------------------------- */

/** Personalização das categorias — definem também as linhas do DRE. */
function CategoriasDespesa({ categorias }: { categorias: ExpenseCategoryDef[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState({ label: "", dreGroup: "custo" as DreGroup });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", dreGroup: "custo" as DreGroup });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function acao(body: Record<string, unknown>, chave: string) {
    setBusy(chave); setErro(null); setMsg(null);
    const res = await fetch("/api/gerencial/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return false; }
    if (j?.mensagem) setMsg(j.mensagem);
    router.refresh();
    return true;
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <Card className="mt-4 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Categorias de despesa</h2>
        <span className="text-[11px] text-muted">definem as linhas do DRE</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        Cada categoria vira uma linha no demonstrativo. <strong>Dedução</strong> abate da receita bruta
        (impostos, taxas); <strong>custo</strong> abate da receita líquida e forma o lucro.
      </p>

      <div className="space-y-1.5">
        {categorias.map((c) => (
          <div key={c.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-line px-2.5 py-2", !c.active && "opacity-50")}>
            {editId === c.id ? (
              <>
                <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className={inputCls + " min-w-0 flex-1"} />
                <select value={editForm.dreGroup} onChange={(e) => setEditForm({ ...editForm, dreGroup: e.target.value as DreGroup })} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400">
                  {DRE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
                <button
                  onClick={async () => { if (await acao({ action: "update", id: c.id, label: editForm.label, dreGroup: editForm.dreGroup }, c.id)) setEditId(null); }}
                  disabled={busy === c.id}
                  className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setEditId(null)} className="text-xs text-muted hover:text-ink">cancelar</button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.label}</span>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  c.dreGroup === "deducao" ? "bg-amber-500/15 text-amber-600" : "bg-subtle text-muted",
                )}>
                  {c.dreGroup === "deducao" ? "dedução" : "custo"}
                </span>
                {!c.active && <span className="shrink-0 text-[10px] text-muted">inativa</span>}
                <button
                  onClick={() => { setEditId(c.id); setEditForm({ label: c.label, dreGroup: c.dreGroup }); }}
                  className="shrink-0 rounded-lg p-1.5 text-muted hover:text-ink" title="Renomear"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {c.active ? (
                  <button
                    onClick={() => { if (window.confirm(`Remover "${c.label}"? Se houver lançamentos, ela só será desativada.`)) acao({ action: "delete", id: c.id }, c.id); }}
                    disabled={busy === c.id}
                    className="shrink-0 rounded-lg p-1.5 text-muted hover:text-rose-500 disabled:opacity-50" title="Remover"
                  >
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <button onClick={() => acao({ action: "update", id: c.id, active: true }, c.id)} className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline">reativar</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input
          value={novo.label}
          onChange={(e) => setNovo({ ...novo, label: e.target.value })}
          placeholder="Nova categoria — ex.: Aluguel, Marketing, Contabilidade"
          className={inputCls + " min-w-0 flex-1"}
        />
        <select value={novo.dreGroup} onChange={(e) => setNovo({ ...novo, dreGroup: e.target.value as DreGroup })} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-400">
          {DRE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <button
          onClick={async () => { if (await acao({ action: "create", label: novo.label, dreGroup: novo.dreGroup }, "novo")) setNovo({ label: "", dreGroup: "custo" }); }}
          disabled={!novo.label.trim() || busy === "novo"}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "novo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Criar
        </button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-amber-600">{msg}</p>}
      {erro && <p className="mt-2 text-[11px] text-rose-500">{erro}</p>}
    </Card>
  );
}

/* -------------------------------- Inadimplência ---------------------------- */

function Inadimplencia({ data }: { data: GerFinance }) {
  return (
    <div className="space-y-4">
      {data.delinquencyTotal > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
              <AlertTriangle className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-rose-100">
                {brl0(data.delinquencyTotal)} em inadimplência — {data.critical.length}{" "}
                {data.critical.length === 1 ? "cliente precisa" : "clientes precisam"} de intervenção
              </p>
              {data.critical[0] && (
                <p className="mt-0.5 text-xs text-ink/70">
                  {data.critical[0].name}: {data.critical[0].note} — escalonamento recomendado
                </p>
              )}
            </div>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/15">
            Notificar equipe
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
          <p className="text-sm font-medium text-emerald-100">
            Nenhuma fatura vencida — carteira em dia.
          </p>
        </div>
      )}

      <Card className="p-5">
        <ul className="space-y-2">
          {data.critical.length === 0 && (
            <li className="rounded-xl bg-subtle p-3 text-sm text-muted">
              Nenhum cliente inadimplente no momento.
            </li>
          )}
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

function Dre() {
  const [periodo, setPeriodo] = useState<DrePeriodo>("mes");
  const [offset, setOffset] = useState(0);
  const [d, setD] = useState<DreResultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao trocar período
    setCarregando(true);
    fetch(`/api/gerencial/dre?periodo=${periodo}&offset=${offset}`)
      .then((r) => r.json())
      .then((j: DreResultado) => { if (vivo) { setD(j); setCarregando(false); } })
      .catch(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [periodo, offset]);

  async function salvarMeta() {
    const v = Number(metaInput.replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v > 100) { setErro("Meta entre 0 e 100."); return; }
    const res = await fetch("/api/gerencial/dre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metaMargin: v }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    if (res?.ok) { setEditandoMeta(false); setErro(null); setD((old) => (old ? { ...old, metaMargin: v } : old)); }
    else setErro(j?.error ?? "Não foi possível salvar a meta.");
  }

  function exportarCsv() {
    if (!d) return;
    const linhas: (string | number)[][] = [
      ["DRE gerencial", d.label],
      ["Período", `${d.from} a ${d.to}`],
      ["Regime", "competência (por vencimento)"],
      [],
      ["Linha", d.label, d.labelAnterior, "Variação %"],
      ...montarLinhasDre(d).map((l) => {
        const v = variacao(l.atual, l.anterior);
        return [l.label, l.atual, l.anterior, v === null ? "—" : v];
      }),
    ];
    const csv = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-${d.label.replace(/[^\w]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (carregando && !d) {
    return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;
  }
  if (!d) return <Card className="p-10 text-center text-sm text-muted">Não foi possível carregar o DRE.</Card>;

  const maxExp = Math.max(...d.topExpenses.map((e) => e.value), 1);
  const maxSerie = Math.max(...d.serie.map((x) => Math.max(x.receita, x.custos)), 1);
  const atingiuMeta = d.atual.margin >= d.metaMargin;

  return (
    <div className="space-y-4">
      {/* Período + ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
            {([["mes","Mês"],["trimestre","Trimestre"],["ano","Ano"]] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => { setPeriodo(k); setOffset(0); }}
                className={cn("px-3 py-1.5 font-medium", periodo === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg border border-line px-2 py-1.5 text-sm text-muted hover:text-ink" title="Período anterior">←</button>
            <span className="min-w-[7rem] text-center text-sm font-semibold text-ink">{d.label}</span>
            <button onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} className="rounded-lg border border-line px-2 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40" title="Próximo período">→</button>
          </div>
          {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
        </div>
        <button onClick={exportarCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle-strong">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {d.semDados && (
        <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
          Nenhum lançamento com vencimento em {d.label}. Os valores abaixo estão zerados.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Demonstrativo com comparativo */}
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">DRE — {d.label}</h2>
            <span className="text-[11px] text-muted">vs. {d.labelAnterior} · competência</span>
          </div>

          <div className="mb-1.5 grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-line pb-1 text-[10px] uppercase tracking-wide text-muted">
            <span>Linha</span>
            <span className="text-right">{d.label}</span>
            <span className="w-16 text-right">vs. ant.</span>
          </div>

          <div className="space-y-1.5">
            {montarLinhasDre(d).map((l, idx) => {
              const a = l.atual;
              const b = l.anterior;
              const v = variacao(a, b);
              // Em custo, subir é ruim; em receita/lucro, subir é bom.
              const bom = v === null ? null : l.negativo ? v <= 0 : v >= 0;
              return (
                <div key={`${l.label}-${idx}`} className={cn("grid grid-cols-[1fr_auto_auto] items-center gap-x-3", l.divisor && "border-t border-line pt-1.5")}>
                  <span className={l.forte ? "text-sm font-medium text-ink" : "text-sm text-muted"}>{l.label}</span>
                  <span className={cn("text-right text-sm tabular-nums", l.negativo ? "text-rose-500" : l.forte ? "font-semibold text-ink" : "text-ink")}>
                    {l.negativo ? "− " : ""}{formatBRL(a)}
                  </span>
                  <span className={cn("w-16 text-right text-[11px] tabular-nums", bom === null ? "text-muted" : bom ? "text-emerald-500" : "text-rose-500")}>
                    {v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Margem e meta */}
          <div className="mt-4 rounded-xl bg-subtle p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">Margem líquida</span>
              <span className={cn("text-xl font-bold", atingiuMeta ? "text-emerald-500" : "text-amber-500")}>
                {d.atual.margin}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className={cn("h-full rounded-full", atingiuMeta ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${Math.max(0, Math.min(100, (d.atual.margin / Math.max(d.metaMargin, 1)) * 100))}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              {editandoMeta ? (
                <span className="flex items-center gap-1.5">
                  <input
                    value={metaInput}
                    onChange={(e) => setMetaInput(e.target.value)}
                    inputMode="decimal"
                    className="h-7 w-16 rounded-lg border border-line bg-surface px-2 text-center text-xs text-ink outline-none focus:border-brand-400"
                  />
                  <span className="text-muted">%</span>
                  <button onClick={salvarMeta} className="rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-700">Salvar</button>
                  <button onClick={() => { setEditandoMeta(false); setErro(null); }} className="text-muted hover:text-ink">cancelar</button>
                </span>
              ) : (
                <button
                  onClick={() => { setEditandoMeta(true); setMetaInput(String(d.metaMargin)); }}
                  className="text-muted hover:text-brand-600"
                >
                  meta {d.metaMargin}% · <span className="underline">editar</span>
                </button>
              )}
              <span className={atingiuMeta ? "text-emerald-500" : "text-amber-500"}>
                {atingiuMeta ? "meta atingida" : `faltam ${Math.max(0, Math.round((d.metaMargin - d.atual.margin) * 10) / 10)} p.p.`}
              </span>
            </div>
            {erro && <p className="mt-1 text-[11px] text-rose-500">{erro}</p>}
          </div>
        </Card>

        {/* Evolução + composição */}
        <div className="space-y-4">
          {d.serie.length > 1 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Receita × custos no período</h2>
              <div className="flex h-36 items-end gap-2">
                {d.serie.map((x) => (
                  <div key={x.mes} className="flex flex-1 flex-col items-center gap-1" title={`${x.mes}: receita ${formatBRL(x.receita)} · custos ${formatBRL(x.custos)} · lucro ${formatBRL(x.lucro)}`}>
                    <div className="flex w-full items-end justify-center gap-0.5" style={{ height: "100%" }}>
                      <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${Math.max(2, (x.receita / maxSerie) * 100)}%` }} />
                      <div className="w-1/2 rounded-t bg-rose-400" style={{ height: `${Math.max(2, (x.custos / maxSerie) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-muted">{x.mes}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Receita</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Custos</span>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Maiores despesas — {d.label}</h2>
            {d.topExpenses.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhuma despesa no período.</p>
            ) : (
              <div className="space-y-2.5">
                {d.topExpenses.map((e) => (
                  <div key={e.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted">{e.label}</span>
                      <span className="shrink-0 tabular-nums text-ink">{formatBRL(e.value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-rose-400" style={{ width: `${(e.value / maxExp) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {d.revenueByClient.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Receita por cliente</h2>
              <div className="space-y-1.5">
                {d.revenueByClient.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-ink">{formatBRL(c.value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Linhas do demonstrativo, na ordem contábil.
 *
 * As deduções e os custos saem das CATEGORIAS cadastradas — por isso a lista é
 * montada a partir do resultado, e não fixa no código. Para o comparativo, o
 * valor do período anterior é buscado pela chave da categoria.
 */
type LinhaDre = {
  label: string;
  atual: number;
  anterior: number;
  negativo?: boolean;
  forte?: boolean;
  divisor?: boolean;
};

function montarLinhasDre(d: DreResultado): LinhaDre[] {
  const antPorChave = new Map<string, number>();
  for (const l of [...d.anterior.deducoes, ...d.anterior.custos]) antPorChave.set(l.key, l.value);
  const ant = (k: string) => antPorChave.get(k) ?? 0;

  return [
    { label: "Receita bruta", atual: d.atual.grossRevenue, anterior: d.anterior.grossRevenue, forte: true },
    ...d.atual.deducoes.map((l) => ({ label: l.label, atual: l.value, anterior: ant(l.key), negativo: true })),
    { label: "Receita líquida", atual: d.atual.netRevenue, anterior: d.anterior.netRevenue, forte: true },
    ...d.atual.custos.map((l, i) => ({
      label: l.label,
      atual: l.value,
      anterior: ant(l.key),
      negativo: true,
      divisor: i === 0,
    })),
    { label: "Total de custos", atual: d.atual.totalCosts, anterior: d.anterior.totalCosts, negativo: true, forte: true },
    { label: "Lucro líquido", atual: d.atual.netProfit, anterior: d.anterior.netProfit, forte: true, divisor: true },
  ];
}
