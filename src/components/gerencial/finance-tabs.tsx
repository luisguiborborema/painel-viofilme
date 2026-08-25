"use client";

import { useMemo, useState } from "react";
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
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type Expense,
  type GerFinance,
  type Receivable,
} from "@/lib/data/gerfinance";
import { RECURRENCES, planejarParcelas, type Recurrence } from "@/lib/data/expense-series";
import {
  ACCOUNT_KINDS,
  MANUAL_METHODS,
  type FinancialAccount,
} from "@/lib/data/gerfinance";

type TabKey = "visao" | "receber" | "pagar" | "contas" | "inadimplencia" | "dre";
type RecFilter = "todas" | "avencer" | "vencida" | "pago";

const TABS: { key: TabKey; label: string }[] = [
  { key: "visao", label: "Visão geral" },
  { key: "receber", label: "Contas a receber" },
  { key: "pagar", label: "Contas a pagar" },
  { key: "contas", label: "Contas & saldos" },
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
      {tab === "contas" && <ContasFinanceiras data={data} />}
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
                    <td className="px-4 py-3 text-muted">{EXPENSE_CATEGORY_LABEL[e.category]}</td>
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
}: {
  onClose: () => void;
  onSaved: () => void;
  /** Quando presente, o formulário edita esta despesa em vez de criar. */
  editar?: Expense | null;
}) {
  const emSerie = Boolean(editar?.seriesId);
  const [f, setF] = useState(() =>
    editar
      ? {
          ...NEW_EXPENSE,
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
        })
      : await postExpense({
          action: "create",
          description: f.description.trim(),
          category: f.category,
          amount: amountNum,
          dueDate: f.dueDate || undefined,
          vendor: f.vendor.trim() || undefined,
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
            {EXPENSE_CATEGORIES.map((c) => (
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
    </div>
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
            DRE gerencial — {data.periodLabel}
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
          <h2 className="mb-1 text-sm font-semibold text-ink">Receita por cliente</h2>
          <p className="mb-3 text-xs text-muted">Faturamento do mês por cliente (Asaas).</p>
          {data.revenueByClient.length === 0 ? (
            <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">Sem cobranças no mês ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.revenueByClient.map((m, i) => {
                const max = data.revenueByClient[0]?.value || 1;
                return (
                  <li key={m.name} className="flex items-center gap-3">
                    <span className="w-36 truncate text-sm text-ink">{m.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                      <div
                        className={cn("h-full rounded-full", i === 0 ? "bg-brand-500" : "bg-brand-400/70")}
                        style={{ width: `${Math.round((m.value / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm font-semibold text-ink">
                      {formatBRL(m.value)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
