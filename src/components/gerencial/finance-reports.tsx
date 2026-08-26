"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, Loader2, Lock, Target, Unlock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import type { Aging, Indicadores, Orcamento } from "@/lib/data/finance-reports-server";
import type { DrePeriodo } from "@/lib/data/dre";
import type { FinanceSettings } from "@/lib/data/finance-settings";
import { TAX_REGIMES } from "@/lib/data/tax";

const brl0 = (v: number) => formatBRL(v).replace(/,\d{2}$/, "");
const inputCls = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

/* -------------------------------- Orçamento -------------------------------- */

/** Orçado × realizado por categoria, com o desvio em destaque. */
export function OrcamentoTab() {
  const [d, setD] = useState<Orcamento | null>(null);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    fetch(`/api/gerencial/finance-reports?view=orcamento&mes=${mes}`)
      .then((r) => r.json())
      .then((j: Orcamento) => setD(j))
      .catch(() => {});
  }
  useEffect(carregar, [mes]);

  async function salvar(categoryKey: string, amount: number) {
    setBusy(categoryKey); setErro(null);
    const res = await fetch("/api/gerencial/finance-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "budget", month: mes, categoryKey, amount }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return; }
    carregar();
  }

  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const saldo = d.totalOrcado - d.totalRealizado;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Mês
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputCls} />
        </label>
        <span className="text-sm text-muted">
          Orçado <strong className="text-ink">{brl0(d.totalOrcado)}</strong> · Realizado{" "}
          <strong className={saldo >= 0 ? "text-emerald-500" : "text-rose-500"}>{brl0(d.totalRealizado)}</strong>
        </span>
      </div>

      {d.semTabela && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Rode a migração <code>0137_budget_and_closing.sql</code> para salvar orçamentos.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 text-right font-medium">Orçado</th>
                <th className="px-4 py-2.5 text-right font-medium">Realizado</th>
                <th className="px-4 py-2.5 font-medium">Consumo</th>
                <th className="px-4 py-2.5 text-right font-medium">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l) => (
                <LinhaOrc key={l.categoryKey} l={l} busy={busy === l.categoryKey} onSalvar={salvar} />
              ))}
              {d.linhas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">Nenhuma categoria com orçamento ou gasto neste mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {erro && <p className="text-xs text-rose-500">{erro}</p>}
      <p className="text-[11px] text-muted">
        Clique no valor orçado para editar. Desvio positivo = gastou mais que o planejado.
      </p>
    </div>
  );
}

function LinhaOrc({
  l, busy, onSalvar,
}: {
  l: Orcamento["linhas"][number];
  busy: boolean;
  onSalvar: (k: string, v: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(l.orcado));
  const estourou = l.consumo !== null && l.consumo > 100;

  return (
    <tr className={cn("border-b border-line last:border-0 hover:bg-subtle", estourou && "bg-rose-500/[0.04]")}>
      <td className="px-4 py-2.5 text-ink">{l.label}</td>
      <td className="px-4 py-2.5 text-right">
        {editando ? (
          <span className="inline-flex items-center gap-1">
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inputCls + " w-24 text-right"} autoFocus />
            <button
              onClick={() => { onSalvar(l.categoryKey, Number(valor.replace(",", ".")) || 0); setEditando(false); }}
              className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700"
              aria-label="Salvar orçamento"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
          </span>
        ) : (
          <button onClick={() => { setValor(String(l.orcado)); setEditando(true); }} className="tabular-nums text-ink underline decoration-dotted underline-offset-2 hover:text-brand-600">
            {l.orcado ? brl0(l.orcado) : "definir"}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-ink">{brl0(l.realizado)}</td>
      <td className="px-4 py-2.5">
        {l.consumo === null ? (
          <span className="text-[11px] text-muted">sem orçamento</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-subtle">
              <div className={cn("h-full rounded-full", estourou ? "bg-rose-500" : l.consumo > 80 ? "bg-amber-500" : "bg-emerald-500")}
                   style={{ width: `${Math.min(100, l.consumo)}%` }} />
            </div>
            <span className={cn("text-[11px] tabular-nums", estourou ? "text-rose-500" : "text-muted")}>{l.consumo}%</span>
          </div>
        )}
      </td>
      <td className={cn("px-4 py-2.5 text-right tabular-nums", l.desvio > 0 ? "text-rose-500" : "text-emerald-500")}>
        {l.desvio > 0 ? "+" : ""}{brl0(l.desvio)}
      </td>
    </tr>
  );
}

/* ---------------------------------- Aging ---------------------------------- */

/** Quanto está vencido e há quanto tempo — prioriza a cobrança. */
export function AgingTab() {
  const [d, setD] = useState<Aging | null>(null);
  useEffect(() => {
    fetch("/api/gerencial/finance-reports?view=aging").then((r) => r.json()).then((j: Aging) => setD(j)).catch(() => {});
  }, []);
  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const max = Math.max(...d.faixas.map((f) => f.valor), d.aVencer.valor, 1);
  const tons = ["bg-amber-400", "bg-orange-500", "bg-rose-500", "bg-rose-700"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Em aberto</p><p className="mt-1 text-2xl font-bold text-ink">{brl0(d.totalAberto)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Vencido</p><p className="mt-1 text-2xl font-bold text-rose-500">{brl0(d.totalVencido)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">A vencer</p><p className="mt-1 text-2xl font-bold text-emerald-500">{brl0(d.aVencer.valor)}</p></Card>
      </div>

      {d.encargosTotal > 0 && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Multa e juros acumulados</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatBRL(d.encargosTotal)}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {d.encargos.fine}% de multa + {d.encargos.interestMonth}% a.m.
            {d.encargos.graceDays > 0 ? ` · ${d.encargos.graceDays} dia(s) de carência` : ""} ·
            valor a cobrar se você aplicar o contrato: <strong className="text-ink">{brl0(d.totalVencido + d.encargosTotal)}</strong>
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">Idade do vencido</h2>
        <p className="mb-3 text-[11px] text-muted">Quanto mais antigo, menor a chance de receber — priorize de baixo para cima.</p>
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600">A vencer</span>
              <span className="text-xs text-muted">{brl0(d.aVencer.valor)} · {d.aVencer.qtd} cobrança(s)</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(d.aVencer.valor / max) * 100}%` }} />
            </div>
          </div>
          {d.faixas.map((f, i) => (
            <div key={f.faixa}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">{f.faixa}</span>
                <span className="text-xs text-muted">{brl0(f.valor)} · {f.qtd} cobrança(s)</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
                <div className={cn("h-full rounded-full", tons[i])} style={{ width: `${(f.valor / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {d.piores.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Maiores devedores</h2>
          <ul className="divide-y divide-line">
            {d.piores.map((c) => (
              <li key={c.name} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-ink">{c.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[11px] text-muted">
                    {c.diasMax}d de atraso{c.encargos > 0 ? ` · +${formatBRL(c.encargos)} de encargos` : ""}
                  </span>
                  <span className="tabular-nums font-semibold text-rose-500">{brl0(c.valor)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Indicadores -------------------------------- */

/** DSO, ticket médio e composição da receita. */
export function IndicadoresCard() {
  const [d, setD] = useState<Indicadores | null>(null);
  const [periodo, setPeriodo] = useState<DrePeriodo>("mes");
  useEffect(() => {
    fetch(`/api/gerencial/finance-reports?view=indicadores&periodo=${periodo}`)
      .then((r) => r.json()).then((j: Indicadores) => setD(j)).catch(() => {});
  }, [periodo]);
  if (!d) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Indicadores — {d.label}</h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {([["mes", "Mês"], ["trimestre", "Tri"], ["ano", "Ano"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriodo(k)} className={cn("px-2.5 py-1 font-medium", periodo === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted"><Clock className="h-3 w-3" /> Prazo de recebimento</p>
          <p className="mt-0.5 text-xl font-bold text-ink">{d.dso === null ? "—" : `${d.dso}d`}</p>
          <p className="text-[10px] text-muted">após o vencimento</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Ticket médio</p>
          <p className="mt-0.5 text-xl font-bold text-ink">{d.ticketMedio === null ? "—" : brl0(d.ticketMedio)}</p>
          <p className="text-[10px] text-muted">{d.clientesFaturados} cliente(s)</p>
        </div>
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted"><Target className="h-3 w-3" /> Receita recorrente</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-500">{d.pctRecorrente === null ? "—" : `${d.pctRecorrente}%`}</p>
          <p className="text-[10px] text-muted">{brl0(d.receitaRecorrente)} de {brl0(d.receitaRecorrente + d.receitaPontual)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Inadimplência</p>
          <p className={cn("mt-0.5 text-xl font-bold", (d.inadimplenciaPct ?? 0) > 10 ? "text-rose-500" : "text-ink")}>
            {d.inadimplenciaPct === null ? "—" : `${d.inadimplenciaPct}%`}
          </p>
          <p className="text-[10px] text-muted">do faturado no período</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------- Fechamento de mês ----------------------------- */

/** Trava o passado consolidado contra edição acidental. */
export function FechamentoPeriodo({ closedUntil }: { closedUntil: string | null }) {
  const [data, setData] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState(closedUntil);

  async function acao(action: "fechar" | "reabrir") {
    setBusy(true); setErro(null);
    const res = await fetch("/api/gerencial/finance-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, closedUntil: action === "fechar" ? data : undefined }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErro(j?.error ?? "Falha."); return; }
    setAtual(action === "fechar" ? data : null);
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-ink">Fechamento de período</h2>
      <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
        Depois de fechar, lançamentos com vencimento até a data <strong>não podem</strong> ser criados,
        editados ou apagados. É o que garante que um relatório fechado não mude depois.
      </p>

      {atual ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <Lock className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1 text-sm text-amber-800">
            Fechado até <strong>{atual.split("-").reverse().join("/")}</strong>
          </span>
          <button onClick={() => acao("reabrir")} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />} Reabrir
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
          <button
            onClick={() => { if (window.confirm(`Fechar o período até ${data.split("-").reverse().join("/")}? Lançamentos anteriores ficarão travados.`)) acao("fechar"); }}
            disabled={!data || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Fechar período
          </button>
        </div>
      )}
      {erro && <p className="mt-2 flex items-center gap-1 text-xs text-rose-500"><AlertTriangle className="h-3 w-3" /> {erro}</p>}
    </Card>
  );
}

/* ------------------- Encargos, impostos e alçada (config) ------------------- */

/**
 * Três regras que mudam o comportamento do sistema, não só a exibição:
 * o que se cobra de quem atrasa, quanto do faturamento é imposto e a partir
 * de que valor uma despesa precisa de segunda assinatura.
 */
export function RegrasFinanceirasCard({
  cfg, onChange, onSave, busy,
}: {
  cfg: FinanceSettings;
  onChange: (patch: Partial<FinanceSettings>) => void;
  onSave: (patch: Partial<FinanceSettings>) => void;
  busy: boolean;
}) {
  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  return (
    <>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Multa e juros por atraso</h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          Padrão de contrato no Brasil: multa de <strong>2%</strong> e juros de <strong>1% ao mês</strong>,
          proporcionais aos dias. Deixe em 0 para não cobrar. O valor calculado aparece na aba
          Aging — ele não é lançado sozinho como cobrança.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Multa (%)
            <input value={cfg.lateFine} onChange={(e) => onChange({ lateFine: num(e.target.value) })} inputMode="decimal" className={inputCls + " mt-1 block w-20"} />
          </label>
          <label className="text-xs text-muted">
            Juros (% ao mês)
            <input value={cfg.lateInterestMonth} onChange={(e) => onChange({ lateInterestMonth: num(e.target.value) })} inputMode="decimal" className={inputCls + " mt-1 block w-24"} />
          </label>
          <label className="text-xs text-muted">
            Carência (dias)
            <input value={cfg.lateGraceDays} onChange={(e) => onChange({ lateGraceDays: Math.round(num(e.target.value)) })} inputMode="numeric" className={inputCls + " mt-1 block w-24"} />
          </label>
          <button
            onClick={() => onSave({ lateFine: cfg.lateFine, lateInterestMonth: cfg.lateInterestMonth, lateGraceDays: cfg.lateGraceDays })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Exemplo: R$ 1.000 vencidos há 30 dias com 2% + 1% a.m. = R$ 20 de multa + R$ 10 de juros.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Impostos sobre o faturamento</h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          Usado só para <strong>provisionar</strong> — separar da margem o dinheiro que é da guia.
          A apuração continua sendo da contabilidade. Informe a alíquota efetiva que você paga hoje.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Regime
            <select value={cfg.taxRegime} onChange={(e) => onChange({ taxRegime: e.target.value })} className={inputCls + " mt-1 block"}>
              {TAX_REGIMES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">
            Alíquota (%)
            <input value={cfg.taxRate} onChange={(e) => onChange({ taxRate: num(e.target.value) })} inputMode="decimal" className={inputCls + " mt-1 block w-24"} />
          </label>
          <label className="text-xs text-muted">
            Vence dia
            <input value={cfg.taxDueDay} onChange={(e) => onChange({ taxDueDay: Math.round(num(e.target.value)) })} inputMode="numeric" className={inputCls + " mt-1 block w-20"} />
          </label>
          <button
            onClick={() => onSave({ taxRegime: cfg.taxRegime, taxRate: cfg.taxRate, taxDueDay: cfg.taxDueDay })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {TAX_REGIMES.find((r) => r.key === cfg.taxRegime)?.hint}
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Alçada de aprovação</h2>
        <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
          Despesa a partir deste valor nasce <strong>aguardando aprovação</strong> e não pode ser paga
          até que um gestor libere. Ela continua no fluxo de caixa e no DRE — o que trava é só a
          baixa. Deixe 0 para desligar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            A partir de (R$)
            <input value={cfg.approvalThreshold} onChange={(e) => onChange({ approvalThreshold: num(e.target.value) })} inputMode="decimal" className={inputCls + " mt-1 block w-28"} />
          </label>
          <button
            onClick={() => onSave({ approvalThreshold: cfg.approvalThreshold })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {cfg.approvalThreshold > 0
            ? `Hoje: despesas de ${formatBRL(cfg.approvalThreshold)} ou mais precisam de gestor ou admin.`
            : "Hoje: qualquer pessoa com acesso ao financeiro pode lançar e pagar."}
        </p>
      </Card>
    </>
  );
}
