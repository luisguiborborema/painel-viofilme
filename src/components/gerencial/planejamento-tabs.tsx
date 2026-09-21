"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brlCent, brlCurto, type Farol } from "@/lib/data/planejamento";
import type { PlanejamentoView } from "@/lib/data/planejamento-server";
import type { PlanejamentoFuturoView } from "@/lib/data/planejamento-futuro-server";
import { AbaCenarios, AbaProjecao } from "./planejamento-futuro";

type Aba = "orcamento" | "projecao" | "cenarios";

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const COR_FAROL: Record<Farol, string> = {
  verde: "bg-emerald-500",
  ambar: "bg-amber-500",
  vermelho: "bg-rose-500",
  cinza: "bg-line",
};

const TEXTO_FAROL: Record<Farol, string> = {
  verde: "Dentro da tolerância ou a favor",
  ambar: "Fora de 10%, até R$ 500",
  vermelho: "Fora de 10% e acima de R$ 500",
  cinza: "Sem orçamento para comparar",
};

export function PlanejamentoTabs({
  dados, futuro, acumulado,
}: {
  dados: PlanejamentoView;
  futuro: PlanejamentoFuturoView;
  acumulado: boolean;
}) {
  const [aba, setAba] = useState<Aba>("orcamento");
  const router = useRouter();
  const params = useSearchParams();

  function irPara(patch: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    router.push(`?${p.toString()}`);
  }

  const ABAS: { key: Aba; label: string }[] = [
    { key: "orcamento", label: "Orçamento" },
    { key: "projecao", label: "Projeção" },
    { key: "cenarios", label: "Cenários" },
  ];

  return (
    <div className="space-y-5">
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

      {aba === "orcamento" && <AbaOrcamento d={dados} acumulado={acumulado} irPara={irPara} />}
      {aba === "projecao" && <AbaProjecao d={futuro} />}
      {aba === "cenarios" && <AbaCenarios d={futuro} />}
    </div>
  );
}

/* ── Orçado × realizado ────────────────────────────────────────────────── */

function AbaOrcamento({
  d, acumulado, irPara,
}: {
  d: PlanejamentoView;
  acumulado: boolean;
  irPara: (p: Record<string, string>) => void;
}) {
  const mesVisivel = useMemo(() => {
    const p = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    return Number(p.get("mes")) || d.mesAtual;
  }, [d.mesAtual]);

  return (
    <div className="space-y-4">
      {!d.temVersao && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-ink">
          <strong>Nenhum orçamento aprovado para {d.ano}.</strong> A comparação abaixo usa os valores
          avulsos da aba Orçamento antiga. Um orçamento versionado nasce do assistente, a partir de
          premissas — não de números digitados mês a mês.
        </p>
      )}

      {d.categoriasSemGrupo.length > 0 && (
        <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-muted">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
          {d.categoriasSemGrupo.length} categoria(s) sem grupo gerencial ficam fora desta tabela:{" "}
          <span className="text-ink">{d.categoriasSemGrupo.slice(0, 6).join(", ")}</span>
          {d.categoriasSemGrupo.length > 6 && "…"}. Defina o grupo em Configurações para elas entrarem no
          orçado × realizado.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Orçado × realizado</h2>
            <p className="text-xs text-muted">
              {acumulado
                ? `Acumulado de janeiro a ${MESES[mesVisivel].toLowerCase()}.`
                : mesVisivel === d.mesAtual
                  ? `${MESES[mesVisivel]} em aberto: realizado até agora.`
                  : `${MESES[mesVisivel]} fechado.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {[
                { k: "mes", label: "Mês" },
                { k: "acum", label: "Acumulado do ano" },
              ].map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => irPara({ per: p.k })}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                    (p.k === "acum") === acumulado ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => irPara({ mes: String(Math.max(1, mesVisivel - 1)) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[96px] text-center text-sm font-semibold text-ink">{MESES[mesVisivel]}</span>
            <button
              type="button"
              aria-label="Próximo mês"
              disabled={mesVisivel >= d.mesAtual}
              onClick={() => irPara({ mes: String(Math.min(d.mesAtual, mesVisivel + 1)) })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">Linha</th>
                <th className="px-3 py-2.5 text-right font-medium">Orçado</th>
                <th className="px-3 py-2.5 text-right font-medium">Realizado</th>
                <th className="px-3 py-2.5 text-right font-medium">Desvio</th>
                <th className="px-3 py-2.5 text-right font-medium">Desvio %</th>
                <th className="px-3 py-2.5 text-center font-medium">Farol</th>
                <th className="px-5 py-2.5 font-medium">Comentário</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {d.linhas.map((l) => (
                <tr key={l.key} className="border-b border-line/60">
                  <td className="px-5 py-2.5 text-ink">{l.label}</td>
                  <td className="px-3 py-2.5 text-right text-muted">
                    {l.orcadoCent ? brlCent(l.orcadoCent) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink">{brlCent(l.realizadoCent)}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right",
                      l.farol === "vermelho" ? "text-rose-600" : l.farol === "ambar" ? "text-amber-600" : "text-muted",
                    )}
                  >
                    {l.orcadoCent ? brlCent(l.desvioCent) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right",
                      l.farol === "vermelho" ? "text-rose-600" : l.farol === "ambar" ? "text-amber-600" : "text-muted",
                    )}
                  >
                    {l.desvioPct == null ? "—" : `${l.desvioPct > 0 ? "+" : ""}${l.desvioPct}%`}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-center">
                      <span
                        title={TEXTO_FAROL[l.farol]}
                        className={cn("h-3 w-3 rounded-full", COR_FAROL[l.farol])}
                      />
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-5 py-2.5 text-xs">
                    {l.comentarioPendente ? (
                      <span className="text-amber-600">Comentar na revisão do mês</span>
                    ) : (
                      <span className="text-muted">{l.comentario ?? ""}</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-subtle font-bold">
                <td className="px-5 py-3 text-ink">Resultado</td>
                <td className="px-3 py-3 text-right text-ink">{brlCent(d.resultadoOrcadoCent)}</td>
                <td className="px-3 py-3 text-right text-ink">{brlCent(d.resultadoRealizadoCent)}</td>
                <td
                  className={cn(
                    "px-3 py-3 text-right",
                    d.resultadoRealizadoCent >= d.resultadoOrcadoCent ? "text-emerald-600" : "text-rose-600",
                  )}
                  colSpan={2}
                >
                  {brlCurto(d.resultadoRealizadoCent - d.resultadoOrcadoCent)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 px-5 py-3 text-[11px] text-muted">
          <Legenda cor="bg-emerald-500" texto="Dentro de ±10% ou a favor" />
          <Legenda cor="bg-amber-500" texto="Fora de 10%, até R$ 500" />
          <Legenda cor="bg-rose-500" texto="Fora de 10% e acima de R$ 500: comentar na revisão" />
          <Legenda cor="bg-line" texto="Sem orçamento para comparar" />
        </div>
      </Card>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", cor)} /> {texto}
    </span>
  );
}

/**
 * Projeção e Cenários dependem de módulos que ainda não existem no banco
 * (recorrências de receita, folha e alocação). O motor de simulação já está
 * pronto e testado; o que falta é de onde ler o estado inicial.
 *
 * Dizer isso é melhor que montar a tela com número inventado: um gráfico de
 * projeção com dado falso é indistinguível de um com dado real.
 */
