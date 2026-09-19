"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brlCent, brlCurto } from "@/lib/data/planejamento";
import { tomDoDelta } from "@/lib/data/resultados";
import type { ResultadosView } from "@/lib/data/resultados-server";

type Aba = "dre" | "rentabilidade" | "receita";

const COR_SEG: Record<string, string> = {
  impostos: "bg-slate-400",
  diretos: "bg-brand-400",
  estrutura: "bg-slate-500",
  financeiro: "bg-slate-600",
  resultado: "bg-emerald-500",
};

export function ResultadosTabs({ dados }: { dados: ResultadosView }) {
  const [aba, setAba] = useState<Aba>("dre");
  const router = useRouter();
  const params = useSearchParams();

  function irParaMes(delta: number) {
    const m = dados.mes + delta;
    const p = new URLSearchParams(params.toString());
    p.set("mes", String(m < 1 ? 12 : m > 12 ? 1 : m));
    p.set("ano", String(m < 1 ? dados.ano - 1 : m > 12 ? dados.ano + 1 : dados.ano));
    router.push(`?${p.toString()}`);
  }

  const ABAS: { key: Aba; label: string }[] = [
    { key: "dre", label: "DRE" },
    { key: "rentabilidade", label: "Rentabilidade" },
    { key: "receita", label: "Receita" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => irParaMes(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[150px] text-center text-sm font-semibold text-ink">{dados.mesLabel}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => irParaMes(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted">comparado com {dados.comparacaoLabel}</span>
      </div>

      <Indicadores d={dados} />

      <div className="flex gap-1 border-b border-line">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
              aba === a.key
                ? "border-brand-500 font-semibold text-ink"
                : "border-transparent font-medium text-muted hover:text-ink",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "dre" && <AbaDre d={dados} />}
      {aba === "rentabilidade" && (
        <Pendente
          titulo="Rentabilidade"
          falta="alocação de equipe e recorrências de receita"
          porque="A margem de contribuição por cliente depende de saber quantas vagas de cada função ele consome. Sem isso, o número que sairia seria receita menos custo direto — e a tela chamaria de margem algo que não é."
        />
      )}
      {aba === "receita" && (
        <Pendente
          titulo="Receita"
          falta="o modelo de recorrências com versões"
          porque="MRR, churn e a ponte de novos/expansão/contração vêm das versões da recorrência e dos motivos de encerramento. Hoje o MRR é estimado a partir de pagamentos, o que não distingue um cliente que saiu de um que atrasou."
        />
      )}
    </div>
  );
}

/* ── Indicadores (§4) ──────────────────────────────────────────────────── */

function Indicadores({ d }: { d: ResultadosView }) {
  const itens = [
    {
      label: "Receita líquida",
      valor: brlCent(d.dre.receitaLiquidaCent),
      delta: d.dre.receitaLiquidaCent - d.dreAnterior.receitaLiquidaCent,
      inverter: false,
      sub: `vs. ${d.comparacaoLabel}`,
    },
    {
      label: "Margem bruta",
      valor: d.dre.margemBrutaPct == null ? "—" : `${d.dre.margemBrutaPct}%`,
      delta: d.dre.margemBrutaCent - d.dreAnterior.margemBrutaCent,
      inverter: false,
      sub: brlCurto(d.dre.margemBrutaCent),
    },
    {
      label: "Resultado operacional",
      valor: brlCent(d.dre.resultadoOperacionalCent),
      delta: d.dre.resultadoOperacionalCent - d.dreAnterior.resultadoOperacionalCent,
      inverter: false,
      sub: d.dre.margemOperacionalPct == null ? "—" : `margem de ${d.dre.margemOperacionalPct}%`,
    },
    {
      label: "Resultado líquido",
      valor: brlCent(d.dre.resultadoLiquidoCent),
      delta: d.dre.resultadoLiquidoCent - d.dreAnterior.resultadoLiquidoCent,
      inverter: false,
      sub: `vs. ${d.comparacaoLabel}`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((i) => {
        const tom = tomDoDelta(i.delta, i.inverter);
        return (
          <Card key={i.label} className="p-4">
            <p className="text-xs text-muted">{i.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{i.valor}</p>
            <p className="mt-1 text-xs text-muted">
              <span
                className={cn(
                  "font-semibold",
                  tom === "bom" ? "text-emerald-600" : tom === "ruim" ? "text-rose-600" : "text-muted",
                )}
              >
                {tom === "neutro" ? "—" : `${i.delta >= 0 ? "+" : ""}${brlCurto(i.delta)}`}
              </span>{" "}
              {i.sub}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Aba DRE ───────────────────────────────────────────────────────────── */

function AbaDre({ d }: { d: ResultadosView }) {
  const LINHAS: { label: string; valor: number; total?: boolean; forte?: boolean; sinal?: string }[] = [
    { label: "Receita bruta", valor: d.dre.receitaBrutaCent },
    { label: "Deduções", valor: d.dre.deducoesCent, sinal: "−" },
    { label: "Receita líquida", valor: d.dre.receitaLiquidaCent, total: true },
    { label: "Custos diretos", valor: d.dre.custosDiretosCent, sinal: "−" },
    { label: "Margem bruta", valor: d.dre.margemBrutaCent, total: true },
    { label: "Despesas operacionais", valor: d.dre.despesasOperacionaisCent, sinal: "−" },
    { label: "Resultado operacional", valor: d.dre.resultadoOperacionalCent, total: true },
    { label: "Resultado financeiro", valor: d.dre.resultadoFinanceiroCent, sinal: "±" },
    { label: "Resultado líquido", valor: d.dre.resultadoLiquidoCent, total: true, forte: true },
  ];

  return (
    <div className="space-y-4">
      {d.semImpacto.length > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-ink">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
          {d.semImpacto.length} categoria(s) sem tipo de impacto ficam fora da DRE:{" "}
          <span className="text-muted">{d.semImpacto.slice(0, 6).join(", ")}</span>
          {d.semImpacto.length > 6 && "…"}. Defina em Configurações — é o tipo que decide se a
          categoria é custo, investimento ou movimento com sócios.
        </p>
      )}

      {/* Para cada R$ 100 (§5.1) */}
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Para cada R$ 100 de receita</h2>
          <span className="text-xs text-muted">
            Receita bruta de {brlCent(d.dre.receitaBrutaCent)} em {d.mesLabel.toLowerCase()}
          </span>
        </div>

        {d.cem.segmentos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sem receita no período.</p>
        ) : (
          <>
            <div className="mt-3 flex h-8 gap-0.5 overflow-hidden rounded-lg">
              {d.cem.segmentos.map((s) => (
                <span
                  key={s.key}
                  title={`${s.label}: ${brlCent(s.valorCent)}`}
                  style={{ width: `${s.pctDaReceita}%` }}
                  className={cn(
                    "flex items-center justify-center text-[11px] font-bold text-white",
                    COR_SEG[s.key] ?? "bg-slate-400",
                  )}
                >
                  {s.pctDaReceita >= 6 ? `R$ ${Math.round(s.pctDaReceita)}` : ""}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              {d.cem.segmentos.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-muted">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", COR_SEG[s.key] ?? "bg-slate-400")} />
                  {s.label} <strong className="text-ink">{brlCent(s.valorCent)}</strong>
                </span>
              ))}
            </div>
          </>
        )}

        {d.cem.prejuizoCent != null && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-600">
            Prejuízo de {brlCent(d.cem.prejuizoCent)} no período.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* DRE (§5.2) */}
        <Card className="overflow-hidden p-0">
          <div className="px-5 py-4">
            <h2 className="text-base font-semibold text-ink">DRE gerencial</h2>
            <p className="text-xs text-muted">Por competência, montada pelo tipo de impacto da categoria.</p>
          </div>
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {LINHAS.map((l) => (
                <tr
                  key={l.label}
                  className={cn("border-t border-line/60", l.total && "bg-subtle")}
                >
                  <td className={cn("px-5 py-2.5", l.total ? "font-bold text-ink" : "text-muted")}>
                    {l.sinal ? `(${l.sinal}) ` : ""}
                    {l.label}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-2.5 text-right",
                      l.forte ? "text-base font-bold" : l.total ? "font-bold" : "",
                      l.valor < 0 && l.total ? "text-rose-600" : "text-ink",
                    )}
                  >
                    {brlCent(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Fora da DRE (§5.4) */}
          <div className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fora da DRE</p>
            <p className="flex justify-between">
              <span className="text-muted">Investimentos do período</span>
              <span className="font-semibold text-ink">{brlCent(d.dre.investimentosCent)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted">Sócios e financiamento</span>
              <span className="font-semibold text-ink">{brlCent(d.dre.sociosCent)}</span>
            </p>
            <p className="pt-1 text-xs text-muted">
              Movimentam o caixa, mas não são receita nem despesa da operação.
            </p>
          </div>
        </Card>

        {/* O que explica a variação (§5.3) */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink">O que explica a variação</h2>
          <p className="mt-0.5 text-xs text-muted">Resultado líquido vs. {d.comparacaoLabel}</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold",
              d.variacao.totalCent >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {d.variacao.totalCent >= 0 ? "+" : ""}
            {brlCurto(d.variacao.totalCent)}
          </p>

          <div className="mt-3 space-y-2">
            {d.variacao.top.length === 0 && (
              <p className="text-sm text-muted">Sem período de comparação.</p>
            )}
            {d.variacao.top.map((v) => (
              <div key={v.key} className="rounded-lg border border-line px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    {v.impactoCent >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                    )}
                    <span className="truncate text-ink">{v.label}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold",
                      v.impactoCent >= 0 ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {v.impactoCent >= 0 ? "+" : ""}
                    {brlCurto(v.impactoCent)}
                  </span>
                </p>
              </div>
            ))}
            {d.variacao.top.length > 0 && (
              <p className="flex justify-between px-3 text-xs text-muted">
                <span>Demais linhas</span>
                <span>
                  {d.variacao.demaisCent >= 0 ? "+" : ""}
                  {brlCurto(d.variacao.demaisCent)}
                </span>
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Aba que depende de módulo inexistente.
 *
 * Diz o que falta e por que o número parcial seria pior que nenhum — a spec
 * inteira é construída sobre "número sempre explicável", e meia conta com
 * rótulo de conta inteira é o contrário disso.
 */
function Pendente({ titulo, falta, porque }: { titulo: string; falta: string; porque: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-semibold text-ink">{titulo} precisa de {falta}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{porque}</p>
    </Card>
  );
}
