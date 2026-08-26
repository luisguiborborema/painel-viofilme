"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, Download, Loader2, Paperclip, RefreshCw, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import type { Cashflow } from "@/lib/data/cashflow-server";
import type { MovimentacoesResultado, Movement } from "@/lib/data/movements-server";
import type { Rentabilidade } from "@/lib/data/profitability-server";
import type { FinancialAccount } from "@/lib/data/gerfinance";
import type { DrePeriodo } from "@/lib/data/dre";

const brl0 = (v: number) => formatBRL(v).replace(/,\d{2}$/, "");
const ddmm = (s: string) => { const [, m, d] = (s ?? "").split("-"); return d && m ? `${d}/${m}` : "—"; };

/* ------------------------------ Fluxo de caixa ----------------------------- */

/** Projeção semana a semana a partir do saldo real das contas. */
export function FluxoDeCaixa() {
  const [d, setD] = useState<Cashflow | null>(null);
  const [semanas, setSemanas] = useState(12);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao mudar a janela
    setCarregando(true);
    fetch(`/api/gerencial/finance-movements?view=fluxo&semanas=${semanas}`)
      .then((r) => r.json())
      .then((j: Cashflow) => { setD(j); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, [semanas]);

  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const maxAbs = Math.max(...d.semanas.map((s) => Math.max(s.entradas, s.saidas)), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
          {[8, 12, 26].map((n) => (
            <button key={n} onClick={() => setSemanas(n)} className={cn("px-3 py-1.5 font-medium", semanas === n ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>
              {n} semanas
            </button>
          ))}
        </div>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>

      {d.semContas && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Nenhuma conta ativa cadastrada — o saldo de partida é zero. Cadastre suas contas em &quot;Contas &amp; categorias&quot;.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Saldo hoje</p><p className={cn("mt-1 text-2xl font-bold", d.saldoHoje >= 0 ? "text-ink" : "text-rose-500")}>{brl0(d.saldoHoje)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">A receber</p><p className="mt-1 text-2xl font-bold text-emerald-500">{brl0(d.totalAReceber)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">A pagar</p><p className="mt-1 text-2xl font-bold text-rose-500">{brl0(d.totalAPagar)}</p></Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Projeção final</p>
          <p className={cn("mt-1 text-2xl font-bold", (d.semanas.at(-1)?.saldoFinal ?? 0) >= 0 ? "text-ink" : "text-rose-500")}>
            {brl0(d.semanas.at(-1)?.saldoFinal ?? 0)}
          </p>
        </Card>
      </div>

      {d.alertaNegativo && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700">
            <strong>Caixa negativo previsto</strong> na semana de {d.alertaNegativo.label}: {brl0(d.alertaNegativo.saldoFinal)}.
            {" "}Antecipe recebimentos ou renegocie vencimentos até lá.
          </p>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold text-ink">Projeção semana a semana</p>
          <p className="text-[11px] text-muted">Parte do saldo real das contas e soma o que vence em cada semana. Só o que ainda não foi liquidado.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Semana</th>
                <th className="px-4 py-2.5 text-right font-medium">Entradas</th>
                <th className="px-4 py-2.5 text-right font-medium">Saídas</th>
                <th className="px-4 py-2.5 font-medium">Movimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo projetado</th>
              </tr>
            </thead>
            <tbody>
              {d.semanas.map((s) => (
                <tr key={s.inicio} className={cn("border-b border-line last:border-0", s.negativo && "bg-rose-500/[0.04]")}>
                  <td className="px-4 py-2.5 text-ink">
                    {s.label}
                    {s.entradasVencidas > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700" title="Inclui cobranças já vencidas e não pagas">
                        +{brl0(s.entradasVencidas)} vencido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-500">{s.entradas ? brl0(s.entradas) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-500">{s.saidas ? brl0(s.saidas) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex h-2 items-center gap-0.5">
                      <div className="flex flex-1 justify-end"><div className="h-2 rounded-l bg-rose-400" style={{ width: `${(s.saidas / maxAbs) * 100}%` }} /></div>
                      <div className="flex flex-1"><div className="h-2 rounded-r bg-emerald-500" style={{ width: `${(s.entradas / maxAbs) * 100}%` }} /></div>
                    </div>
                  </td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", s.negativo ? "text-rose-500" : "text-ink")}>
                    {brl0(s.saldoFinal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- Extrato --------------------------------- */

const SITUACOES = [
  { key: "", label: "Tudo" },
  { key: "pendente", label: "Previsto" },
  { key: "liquidado", label: "Liquidado" },
  { key: "naoConciliado", label: "A conciliar" },
];

/** Extrato consolidado: entradas, saídas e transferências, com conciliação. */
export function Extrato({ contas }: { contas: FinancialAccount[] }) {
  const [d, setD] = useState<MovimentacoesResultado | null>(null);
  const [conta, setConta] = useState("");
  const [situacao, setSituacao] = useState("");
  const [kind, setKind] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    setCarregando(true);
    const q = new URLSearchParams({ view: "extrato" });
    if (conta) q.set("conta", conta);
    if (situacao) q.set("situacao", situacao);
    if (kind) q.set("kind", kind);
    fetch(`/api/gerencial/finance-movements?${q}`)
      .then((r) => r.json())
      .then((j: MovimentacoesResultado) => { setD(j); setSel(new Set()); setCarregando(false); })
      .catch(() => setCarregando(false));
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao trocar filtro
  useEffect(carregar, [conta, situacao, kind]);

  async function conciliar(desfazer = false) {
    if (sel.size === 0) return;
    setBusy(true);
    await fetch("/api/gerencial/finance-movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: desfazer ? "desreconciliar" : "reconciliar", ids: [...sel] }),
    }).catch(() => null);
    setBusy(false);
    carregar();
  }

  function exportar() {
    if (!d) return;
    const linhas = [
      ["Data", "Tipo", "Descrição", "Conta", "Cliente", "Valor", "Situação", "Conciliado"],
      ...d.movimentos.map((m) => [
        m.date, m.kind, m.description, m.accountName ?? "", m.clientName ?? "",
        (m.kind === "saida" ? -m.value : m.value).toFixed(2),
        m.liquidado ? "liquidado" : "previsto",
        m.reconciliadoEm ? "sim" : "não",
      ]),
    ];
    const csv = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "extrato.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const selecionaveis = d.movimentos.filter((m) => m.origem !== "transfer" && m.liquidado);
  const selCls = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={conta} onChange={(e) => setConta(e.target.value)} className={selCls}>
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={selCls}>
            <option value="">Entradas e saídas</option>
            <option value="entrada">Só entradas</option>
            <option value="saida">Só saídas</option>
            <option value="transferencia">Só transferências</option>
          </select>
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
            {SITUACOES.map((s) => (
              <button key={s.key} onClick={() => setSituacao(s.key)} className={cn("px-3 py-1.5 font-medium", situacao === s.key ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>
                {s.label}
              </button>
            ))}
          </div>
          {carregando && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
          <button onClick={exportar} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle-strong"><Download className="h-3.5 w-3.5" /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Entrou</p><p className="mt-1 text-xl font-bold text-emerald-500">{brl0(d.totais.entradas)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Saiu</p><p className="mt-1 text-xl font-bold text-rose-500">{brl0(d.totais.saidas)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Resultado</p><p className={cn("mt-1 text-xl font-bold", d.totais.saldo >= 0 ? "text-ink" : "text-rose-500")}>{brl0(d.totais.saldo)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Previsto</p><p className="mt-1 text-sm font-semibold text-ink"><span className="text-emerald-500">+{brl0(d.totais.pendenteEntrada)}</span> · <span className="text-rose-500">−{brl0(d.totais.pendenteSaida)}</span></p></Card>
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-50/40 px-3 py-2">
          <span className="text-sm text-ink">{sel.size} selecionado(s)</span>
          <button onClick={() => conciliar(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Marcar como conciliado
          </button>
          <button onClick={() => conciliar(true)} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">Desfazer conciliação</button>
          <button onClick={() => setSel(new Set())} className="text-xs text-muted hover:text-ink">limpar</button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selecionaveis.length > 0 && sel.size === selecionaveis.length}
                    onChange={(e) => setSel(e.target.checked ? new Set(selecionaveis.map((m) => m.id)) : new Set())}
                    className="h-4 w-4 rounded border-line"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Data</th>
                <th className="px-3 py-2.5 font-medium">Descrição</th>
                <th className="px-3 py-2.5 font-medium">Conta</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {d.movimentos.map((m) => <LinhaMov key={m.id} m={m} sel={sel} setSel={setSel} />)}
              {d.movimentos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">Nenhuma movimentação com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function LinhaMov({ m, sel, setSel }: { m: Movement; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  const podeConciliar = m.origem !== "transfer" && m.liquidado;
  return (
    <tr className="border-b border-line last:border-0 hover:bg-subtle">
      <td className="px-3 py-2.5">
        {podeConciliar && (
          <input
            type="checkbox"
            checked={sel.has(m.id)}
            onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(m.id); else n.delete(m.id); setSel(n); }}
            className="h-4 w-4 rounded border-line"
            aria-label={`Selecionar ${m.description}`}
          />
        )}
      </td>
      <td className="px-3 py-2.5 text-muted">{ddmm(m.date)}</td>
      <td className="px-3 py-2.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {m.kind === "entrada" ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" /> : m.kind === "saida" ? <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" /> : <RefreshCw className="h-3.5 w-3.5 text-sky-500" />}
          <span className="text-ink">{m.description}</span>
          {m.clientName && <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">{m.clientName}</span>}
          {m.anexo && (
            <a href={m.anexo} target="_blank" rel="noopener" className="text-muted hover:text-brand-600" title="Ver comprovante">
              <Paperclip className="h-3 w-3" />
            </a>
          )}
        </span>
      </td>
      <td className="px-3 py-2.5 text-muted">{m.accountName ?? "—"}</td>
      <td className={cn("px-3 py-2.5 text-right tabular-nums", m.kind === "saida" ? "text-rose-500" : m.kind === "entrada" ? "text-emerald-500" : "text-sky-500")}>
        {m.kind === "saida" ? "−" : m.kind === "entrada" ? "+" : ""}{brl0(m.value)}
      </td>
      <td className="px-3 py-2.5">
        {!m.liquidado ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700">previsto</span>
        ) : m.reconciliadoEm ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            <Check className="h-3 w-3" /> conciliado
          </span>
        ) : (
          <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">a conciliar</span>
        )}
      </td>
    </tr>
  );
}

/* ----------------------------- Rentabilidade -------------------------------- */

/** Receita − custo direto por cliente. Não rateia custo de estrutura. */
export function RentabilidadeClientes() {
  const [d, setD] = useState<Rentabilidade | null>(null);
  const [periodo, setPeriodo] = useState<DrePeriodo>("mes");

  useEffect(() => {
    fetch(`/api/gerencial/finance-movements?view=rentabilidade&periodo=${periodo}`)
      .then((r) => r.json())
      .then((j: Rentabilidade) => setD(j))
      .catch(() => {});
  }, [periodo]);

  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const maxRec = Math.max(...d.clientes.map((c) => c.receita), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
          {([["mes", "Mês"], ["trimestre", "Trimestre"], ["ano", "Ano"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriodo(k)} className={cn("px-3 py-1.5 font-medium", periodo === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
        <span className="text-sm text-muted">{d.label}</span>
      </div>

      <div className="rounded-xl bg-subtle px-3 py-2.5 text-[11px] leading-relaxed text-muted">
        <strong className="text-ink">Margem de contribuição</strong>, não lucro final: entra só o custo
        <strong> diretamente vinculado</strong> ao cliente. Custo de estrutura ({brl0(d.custoIndireto)} no período)
        não é rateado — um rateio sem critério definido engana mais do que ajuda. Para vincular, escolha o
        cliente ao lançar a despesa.
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-right font-medium">Receita</th>
                <th className="px-4 py-2.5 text-right font-medium">Custo direto</th>
                <th className="px-4 py-2.5 text-right font-medium">Contribuição</th>
                <th className="px-4 py-2.5 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody>
              {d.clientes.map((c) => (
                <tr key={c.clientId} className="border-b border-line last:border-0 hover:bg-subtle">
                  <td className="px-4 py-2.5">
                    <p className="text-ink">{c.name}</p>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.receita / maxRec) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">{brl0(c.receita)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-500">{c.custoDireto ? `−${brl0(c.custoDireto)}` : "—"}</td>
                  <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", c.contribuicao >= 0 ? "text-emerald-500" : "text-rose-500")}>{brl0(c.contribuicao)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums", (c.margem ?? 0) >= 50 ? "text-emerald-500" : (c.margem ?? 0) >= 20 ? "text-amber-500" : "text-rose-500")}>
                    {c.margem === null ? "—" : `${c.margem}%`}
                  </td>
                </tr>
              ))}
              {d.clientes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">Nenhuma receita de cliente no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {d.clientes.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <TrendingUp className="h-3.5 w-3.5" />
          Receita {brl0(d.totalReceita)} · custo direto {brl0(d.totalCustoDireto)} · contribuição {brl0(d.totalReceita - d.totalCustoDireto)}
        </p>
      )}
    </div>
  );
}
