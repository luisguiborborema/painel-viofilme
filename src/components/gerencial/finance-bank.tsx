"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Ban, Check, FileUp, Landmark,
  Link2, Loader2, RefreshCw, Trash2, Undo2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import type { FinancialAccount } from "@/lib/data/gerfinance";
import type { PainelConciliacao } from "@/lib/data/reconciliation-server";
import type { PainelImpostos } from "@/lib/data/finance-reports-server";
import { TAX_REGIMES } from "@/lib/data/tax";

const fmtDia = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");
const btn = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-60";

/* ------------------------- Conciliação bancária ---------------------------- */

/**
 * Confronta o extrato do banco com os lançamentos.
 *
 * Três colunas de verdade: o que casou, o que o banco registrou e o painel não
 * (faltou lançar) e o que o painel diz ter liquidado e o banco não mostra
 * (marcaram como pago e não caiu). É esta segunda lista que costuma revelar
 * problema de verdade.
 */
export function ConciliacaoBancaria({ contas }: { contas: FinancialAccount[] }) {
  const ativas = contas.filter((c) => c.active !== false);
  const [contaId, setContaId] = useState<string>(ativas[0]?.id ?? "");
  const [d, setD] = useState<PainelConciliacao | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"pendentes" | "todos" | "casados">("pendentes");
  const inputFile = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    if (!contaId) return;
    fetch(`/api/gerencial/reconciliation?conta=${contaId}`)
      .then((r) => r.json())
      .then((j: PainelConciliacao) => setD(j))
      .catch(() => {});
  }, [contaId]);
  useEffect(carregar, [carregar]);

  async function acao(body: Record<string, unknown>, chave: string) {
    setBusy(chave); setErro(null); setMsg(null);
    const res = await fetch("/api/gerencial/reconciliation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível concluir."); return null; }
    carregar();
    return j;
  }

  async function importar(file: File) {
    if (!contaId) { setErro("Escolha a conta antes de importar."); return; }
    setBusy("import"); setErro(null); setMsg(null);
    const content = await file.text();
    const res = await fetch("/api/gerencial/reconciliation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "importar", accountId: contaId, fileName: file.name, content }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (inputFile.current) inputFile.current.value = "";
    if (!res?.ok) { setErro(j?.error ?? "Falha ao importar."); return; }
    setMsg(
      `${j.lidas} linha(s) lidas · ${j.novas} nova(s)` +
      (j.repetidas ? ` · ${j.repetidas} já existiam` : "") +
      ` · ${j.casadas} casada(s) automaticamente` +
      (j.ambiguas ? ` · ${j.ambiguas} precisam de escolha` : ""),
    );
    carregar();
  }

  if (ativas.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Cadastre uma conta em <strong className="text-ink">Contas &amp; categorias</strong> antes de conciliar.
      </Card>
    );
  }

  const linhas = (d?.entradas ?? []).filter((e) =>
    filtro === "todos" ? true : filtro === "casados" ? Boolean(e.matchedId) : !e.matchedId && !e.ignored,
  );
  const semCasarLista = (d?.semExtrato ?? []);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Conta
            <select
              value={contaId}
              onChange={(e) => { setContaId(e.target.value); setD(null); }}
              className="mt-1 block rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            >
              {ativas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <input
            ref={inputFile}
            type="file"
            accept=".ofx,.OFX,.csv,.txt,text/csv,text/plain"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); }}
            className="hidden"
          />
          <button onClick={() => inputFile.current?.click()} disabled={busy === "import"}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importar extrato
          </button>
          <button onClick={() => acao({ action: "reprocessar", accountId: contaId }, "reproc")} disabled={busy === "reproc"} className={btn + " py-2"}>
            {busy === "reproc" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Reprocessar
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Exporte no seu banco o extrato em <strong>OFX</strong> (às vezes chamado de &quot;para gerenciador
          financeiro&quot; ou Money/Quicken) ou em CSV. Importar o mesmo período duas vezes não duplica nada.
        </p>

        {(d?.importacoes ?? []).length > 0 && (
          <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
            {d!.importacoes.map((imp) => (
              <li key={imp.id} className="flex flex-wrap items-center gap-2 py-1.5 text-[11px] text-muted">
                <span className="min-w-0 flex-1 truncate">
                  {imp.fileName ?? "arquivo"} · {fmtDia(imp.from ?? "")} a {fmtDia(imp.to ?? "")} · {imp.total} linha(s)
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(`Desfazer a importação de "${imp.fileName ?? "arquivo"}"? As linhas dela e os casamentos feitos serão apagados.`)) {
                      acao({ action: "excluirImportacao", statementId: imp.id }, imp.id);
                    }
                  }}
                  disabled={busy === imp.id}
                  className={btn}
                  title="Desfazer esta importação"
                >
                  {busy === imp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{msg}</p>}
        {erro && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
      </Card>

      {d && d.resumo.total > 0 && (
        <Card className="p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Conferência do período</h2>
            <span className={cn("text-sm font-semibold", d.resumo.fechado ? "text-emerald-500" : "text-amber-600")}>
              {d.resumo.pct}% conferido
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle">
            <div className={cn("h-full rounded-full", d.resumo.fechado ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${d.resumo.pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {d.resumo.casados} casada(s) · {d.resumo.ignorados} dispensada(s) · {d.resumo.pendentes} sem conferir
            {d.resumo.fechado && " — extrato inteiro explicado"}
          </p>
        </Card>
      )}

      {/* Linhas do banco */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Landmark className="h-4 w-4 text-muted" /> Extrato do banco
          </h2>
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
            {([["pendentes", "Pendentes"], ["casados", "Casados"], ["todos", "Todos"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)} className={cn("px-2.5 py-1 font-medium", filtro === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>{l}</button>
            ))}
          </div>
        </div>

        {linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {d?.entradas.length ? "Nada nesse filtro." : "Nenhum extrato importado ainda para esta conta."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {linhas.map((e) => (
              <li key={e.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5", e.ignored && "opacity-50")}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", e.amount >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                  {e.amount >= 0 ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{e.memo || "Lançamento"}</span>
                  <span className="block text-[11px] text-muted">
                    {fmtDia(e.date)}
                    {e.matchedLabel && <> · casado com <strong className="text-emerald-600">{e.matchedLabel}</strong></>}
                    {e.ignored && !e.matchedId && " · dispensado"}
                  </span>
                </span>
                <span className={cn("shrink-0 tabular-nums text-sm font-semibold", e.amount >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {formatBRL(Math.abs(e.amount))}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {e.matchedId ? (
                    <button onClick={() => acao({ action: "descasar", entryId: e.id }, e.id)} disabled={busy === e.id} className={btn} title="Desfazer o casamento">
                      {busy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <>
                      <CasarManual entry={e} candidatos={semCasarLista} onCasar={(movId) => acao({ action: "casar", entryId: e.id, movId }, e.id)} busy={busy === e.id} />
                      <button
                        onClick={() => acao({ action: e.ignored ? "reconsiderar" : "ignorar", entryId: e.id }, e.id)}
                        disabled={busy === e.id}
                        className={btn}
                        title={e.ignored ? "Voltar para pendentes" : "Dispensar (tarifa, rendimento, estorno)"}
                      >
                        {e.ignored ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* O outro lado da divergência */}
      {semCasarLista.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Liquidado no painel, ausente no banco</h2>
          <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
            Marcados como pagos/recebidos, mas sem linha correspondente no extrato. Ou o extrato
            importado não cobre a data, ou a baixa foi dada sem o dinheiro ter circulado.
          </p>
          <ul className="divide-y divide-line">
            {semCasarLista.slice(0, 20).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{m.description}</span>
                <span className="shrink-0 text-[11px] text-muted">{fmtDia(m.date)}</span>
                <span className={cn("shrink-0 tabular-nums font-medium", m.kind === "entrada" ? "text-emerald-500" : "text-rose-500")}>
                  {formatBRL(m.value)}
                </span>
              </li>
            ))}
          </ul>
          {semCasarLista.length > 20 && <p className="mt-2 text-[11px] text-muted">e mais {semCasarLista.length - 20}…</p>}
        </Card>
      )}
    </div>
  );
}

/** Casamento manual: escolhe entre os lançamentos que ainda não casaram. */
function CasarManual({
  entry, candidatos, onCasar, busy,
}: {
  entry: { amount: number };
  candidatos: { id: string; date: string; value: number; description: string; kind: string }[];
  onCasar: (movId: string) => void;
  busy: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const alvo = entry.amount >= 0 ? "entrada" : "saida";
  // Mais próximos em valor primeiro — quase sempre o certo está no topo.
  const opcoes = candidatos
    .filter((c) => c.kind === alvo)
    .sort((a, b) => Math.abs(a.value - Math.abs(entry.amount)) - Math.abs(b.value - Math.abs(entry.amount)))
    .slice(0, 12);

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} disabled={busy || opcoes.length === 0} className={btn} title={opcoes.length ? "Casar manualmente" : "Nenhum lançamento disponível"}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
      </button>
    );
  }
  return (
    <select
      autoFocus
      defaultValue=""
      onChange={(e) => { if (e.target.value) onCasar(e.target.value); setAberto(false); }}
      onBlur={() => setAberto(false)}
      className="max-w-[16rem] rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
    >
      <option value="">escolher lançamento…</option>
      {opcoes.map((c) => (
        <option key={c.id} value={c.id}>{fmtDia(c.date)} · {formatBRL(c.value)} · {c.description}</option>
      ))}
    </select>
  );
}

/* ------------------------------- Impostos ---------------------------------- */

/** Provisão de imposto sobre o faturamento — o dinheiro que não é lucro. */
export function Impostos() {
  const [d, setD] = useState<PainelImpostos | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    fetch("/api/gerencial/finance-reports?view=impostos")
      .then((r) => r.json()).then((j: PainelImpostos) => setD(j)).catch(() => {});
  }, []);
  useEffect(carregar, [carregar]);

  async function lancar(mes: string, valor: number) {
    setBusy(mes); setErro(null);
    const res = await fetch("/api/gerencial/finance-reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lancarImposto", taxMonth: mes, taxAmount: valor }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível lançar."); return; }
    carregar();
  }

  if (!d) return <Card className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></Card>;

  const regime = TAX_REGIMES.find((r) => r.key === d.config.regime);
  const desligado = d.config.regime === "nenhum" || d.config.rate <= 0;

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Provisão de impostos</h2>
        <span className="text-[11px] text-muted">{regime?.label ?? d.config.regime} · {d.config.rate}%</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        Estimativa sobre o faturamento do mês, para o saldo em conta não ser confundido com lucro.
        Não substitui a apuração da contabilidade — quando a guia sair, lance com o valor real.
      </p>

      {desligado ? (
        <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
          Informe o regime e a alíquota em <strong className="text-ink">Configurações</strong> para provisionar.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {d.meses.map((m) => (
              <li key={m.mes} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 font-medium text-ink">{m.mes.split("-").reverse().join("/")}</span>
                <span className="min-w-0 flex-1 text-[11px] text-muted">
                  faturou {formatBRL(m.faturamento)} · guia vence {fmtDia(m.vencimento)}
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-ink">{formatBRL(m.valor)}</span>
                {m.jaLancado ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    <Check className="h-3 w-3" /> lançada
                  </span>
                ) : (
                  <button onClick={() => lancar(m.mes, m.valor)} disabled={busy === m.mes || m.valor <= 0} className={btn + " shrink-0"}>
                    {busy === m.mes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Lançar a pagar
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            A provisionar: <strong className="text-ink">{formatBRL(d.totalProvisionado)}</strong>
          </p>
        </>
      )}
      {erro && <p className="mt-2 text-xs text-rose-500">{erro}</p>}
    </Card>
  );
}
