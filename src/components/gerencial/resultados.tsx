"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Chevron, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type {
  LinhaDre, ResultadosView as Dados,
} from "@/lib/data/resultados-server";

/**
 * Resultados (spec da página 5) — onde estamos ganhando ou perdendo dinheiro.
 *
 * Tudo por competência: receita é o que foi vendido no período, custo é o que
 * foi consumido nele. O Caixa mostra o dinheiro; esta página, o desempenho.
 *
 * Nenhum número é calculado aqui. A tela recebe a DRE montada, a variação já
 * explicada e a ponte com as alturas das barras resolvidas.
 */

const TOM_DELTA: Record<string, string> = {
  bom: "text-emerald-600",
  ruim: "text-rose-600",
  neutro: "text-muted",
};

const ABAS = [
  { key: "dre", label: "DRE" },
  { key: "rentabilidade", label: "Rentabilidade" },
  { key: "receita", label: "Receita" },
];

export function ResultadosView({ dados, aba }: { dados: Dados; aba: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function irPara(patch: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    router.push(`?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Cabecalho />

      {dados.pendente ? (
        <Aviso titulo="Falta rodar a migração." texto={dados.pendenteMotivo ?? ""} />
      ) : dados.semDados ? (
        <Aviso
          titulo="Sem conexão com o banco"
          texto="A página lê dados reais e não mostra exemplo no lugar deles."
        />
      ) : (
        <>
          <Controles dados={dados} irPara={irPara} />
          <Indicadores dados={dados} />

          <div className="flex gap-1 border-b border-line">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => irPara({ aba: a.key })}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
                  aba === a.key
                    ? "border-brand-500 font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          {aba === "dre" && <AbaDre dados={dados} irPara={irPara} />}
          {aba === "rentabilidade" && <EmConstrucao titulo="Rentabilidade" />}
          {aba === "receita" && <EmConstrucao titulo="Receita" />}
        </>
      )}
    </div>
  );
}

/* ── Cabeçalho e controles (§3) ────────────────────────────────────────── */

function Cabecalho() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Resultados</h1>
        <p className="mt-1 text-sm text-muted">
          Onde estamos ganhando e perdendo dinheiro. Tudo por competência.
        </p>
      </div>
      <button
        type="button"
        onClick={() => toast("O relatório em PDF de uma página ainda não existe nesta tela.", "error")}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand-300"
      >
        <Download className="h-4 w-4" />
        Exportar relatório do mês
      </button>
    </header>
  );
}

function Controles({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const [seloAberto, setSeloAberto] = useState(false);

  function mudarPeriodo(delta: number) {
    const [a, m] = dados.periodo.iso.split("-").map(Number);
    const passo = dados.periodo.gran === "tri" ? 3 : 1;
    const d = new Date(Date.UTC(a, m - 1 + delta * passo, 1));
    irPara({ periodo: d.toISOString().slice(0, 7) });
  }

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
        {[["mes", "Mês"], ["tri", "Trimestre"]].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => irPara({ gran: k })}
            aria-pressed={dados.periodo.gran === k}
            className={cn(
              "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
              dados.periodo.gran === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button type="button" aria-label="Período anterior" onClick={() => mudarPeriodo(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[170px] text-center text-sm font-semibold text-ink">
          {dados.periodo.label}
        </span>
        <button type="button" aria-label="Próximo período" onClick={() => mudarPeriodo(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:text-ink">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        Comparar com
        <select
          value={dados.comparacaoKey}
          onChange={(e) => irPara({ comp: e.target.value })}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="ant">Período anterior</option>
          <option value="yoy">Mesmo período do ano anterior</option>
          {/* Sem orçamento aprovado no ano não há com o que comparar, e a
              opção fica desligada em vez de mostrar zero como meta. */}
          <option value="orc" disabled={!dados.orcadoDisponivel}>
            {dados.orcadoDisponivel ? "Orçado" : `Orçado — ${dados.orcadoMotivo}`}
          </option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => dados.ajustes.length && setSeloAberto((v) => !v)}
        className={cn(
          "flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
          dados.selo.tom === "ok"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
            : "border-amber-500/40 bg-amber-500/10 text-amber-600",
          dados.ajustes.length ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {dados.selo.texto}
      </button>

      {seloAberto && dados.ajustes.length > 0 && (
        <div className="absolute top-11 right-0 z-20 w-[420px] space-y-2 rounded-xl border border-line bg-surface p-4 shadow-xl">
          <p className="text-sm font-semibold text-ink">Ajustes após o fechamento</p>
          {dados.ajustes.map((a, n) => (
            <div key={n} className="rounded-lg bg-subtle px-3 py-2">
              <p className="flex justify-between text-xs font-medium text-ink">
                <span>{a.linha}</span><span>{a.valor}</span>
              </p>
              <p className="text-[11px] text-muted">{a.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Faixa de indicadores (§4) ─────────────────────────────────────────── */

function Indicadores({ dados }: { dados: Dados }) {
  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {dados.indicadores.map((i) => (
        <Card key={i.key} className="flex flex-col gap-2 p-5">
          <span className="text-xs text-muted">{i.label}</span>
          <span className="text-2xl font-semibold tracking-tight text-ink">{i.valor}</span>
          <span className="text-xs text-muted">
            <b className={cn("font-semibold", TOM_DELTA[i.deltaTom])}>{i.delta}</b> {i.contexto}
          </span>
        </Card>
      ))}
    </section>
  );
}

/* ── Aba DRE (§5) ──────────────────────────────────────────────────────── */

function AbaDre({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const [abertos, setAbertos] = useState<string[]>(dados.gruposAbertos);

  const alternar = (k: string) =>
    setAbertos((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  const visiveis = dados.linhas.filter(
    (l) => l.nivel !== "categoria" || abertos.includes(l.grupo ?? ""),
  );

  return (
    <section aria-label="DRE" className="space-y-4">
      <ParaCadaCem dados={dados} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">DRE gerencial</h2>
              <p className="text-xs text-muted">
                Clique numa linha de grupo para abrir as categorias.
              </p>
            </div>
            <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
              {[["periodo", "Período"], ["evo", "Evolução mensal"]].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => irPara({ modo: k })}
                  aria-pressed={dados.modo === k}
                  className={cn(
                    "h-7 rounded-lg px-2.5 text-[11px] font-medium transition-colors",
                    dados.modo === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border-t border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-subtle text-[11px] text-muted">
                  <th className="sticky left-0 z-10 bg-subtle px-4 py-2.5 text-left font-normal">
                    {dados.periodo.label}
                  </th>
                  {dados.colunas.map((c) => (
                    <th key={c} className="px-3 py-2.5 text-right font-normal whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <LinhaDaDre
                    key={l.key}
                    l={l}
                    dados={dados}
                    aberto={abertos.includes(l.key)}
                    onAlternar={() => alternar(l.key)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {dados.semImpacto.length > 0 && (
            <p className="border-t border-line bg-amber-500/5 px-5 py-3 text-[11px] text-amber-600">
              {dados.semImpacto.length === 1 ? "A categoria" : "As categorias"}{" "}
              {dados.semImpacto.join(", ")} não {dados.semImpacto.length === 1 ? "tem" : "têm"} tipo
              de impacto e {dados.semImpacto.length === 1 ? "fica" : "ficam"} fora da DRE. Defina em
              Financeiro › Configurações.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Variacao dados={dados} />
          <ForaDaDre dados={dados} />
        </div>
      </div>

      <PonteDoCaixa dados={dados} />
    </section>
  );
}

function ParaCadaCem({ dados }: { dados: Dados }) {
  const { segmentos, prejuizoCent } = dados.cem;
  if (!segmentos.length) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Para cada R$ 100 de receita</h2>
        <p className="mt-1 text-xs text-muted">
          Sem receita com competência em {dados.periodo.label.toLowerCase()}, não há o que dividir.
        </p>
      </Card>
    );
  }

  const cores = [
    "bg-slate-400", "bg-violet-900", "bg-violet-500", "bg-slate-600",
    "bg-slate-500", "bg-slate-700", "bg-brand-500",
  ];

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Para cada R$ 100 de receita</h2>
        <span className="text-xs text-muted">{dados.cem.subtitulo}</span>
      </div>

      <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
        {segmentos.map((s, i) => (
          <span
            key={s.key}
            title={`${s.label}: R$ ${s.pctDaReceita}`}
            className={cn("flex items-center justify-center text-[11px] font-bold text-white", cores[i % cores.length])}
            style={{ width: `${Math.max(0, s.pctDaReceita)}%` }}
          >
            {s.pctDaReceita >= 6 ? `R$ ${Math.round(s.pctDaReceita)}` : ""}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segmentos.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5 text-muted">
            <span className={cn("h-2.5 w-2.5 rounded-sm", cores[i % cores.length])} />
            {s.label} <b className="font-semibold text-ink">R$ {s.pctDaReceita}</b>
          </span>
        ))}
      </div>

      {prejuizoCent !== null && (
        <p className="text-xs font-semibold text-rose-600">
          Prejuízo de R$ {Math.abs(Math.round(prejuizoCent / 100))} a cada R$ 100 de receita.
        </p>
      )}
    </Card>
  );
}

function LinhaDaDre({
  l, dados, aberto, onAlternar,
}: { l: LinhaDre; dados: Dados; aberto: boolean; onAlternar: () => void }) {
  const total = l.nivel === "total";
  const grupo = l.nivel === "grupo";
  const negativo = l.sinal === -1;

  // Custo aumentar é ruim; receita aumentar é bom. É a mesma regra do delta
  // invertido do Portal, e sem ela a DRE pinta de verde uma despesa crescendo.
  const tomDelta = Math.abs(l.deltaCent) < 100
    ? "neutro" : (negativo ? l.deltaCent < 0 : l.deltaCent > 0) ? "bom" : "ruim";

  const valor = (c: number) => (c === 0 ? "—" : brlCheio(negativo ? -c : c).replace("R$ ", ""));

  const celulas = dados.modo === "evo"
    ? l.meses.map((m) => (
        <td key={m.mes} className="px-3 py-2.5 text-right tabular-nums">
          <span className="block">{valor(m.valorCent)}</span>
          {m.pctRl !== null && m.valorCent !== 0 && (
            <span className="block text-[10px] text-muted">
              {m.pctRl.toFixed(0)}%
            </span>
          )}
        </td>
      ))
    : dados.mesAberto
      ? [
          <td key="r" className="px-3 py-2.5 text-right tabular-nums">{l.nivel === "categoria" ? valor(l.realizadoCent) : ""}</td>,
          <td key="p" className="px-3 py-2.5 text-right tabular-nums text-muted">{l.nivel === "categoria" ? valor(l.previstoCent) : ""}</td>,
          <td key="t" className="px-3 py-2.5 text-right tabular-nums">{valor(l.valorCent)}</td>,
          <td key="pct" className="px-3 py-2.5 text-right tabular-nums text-muted">{l.pctRl === null ? "—" : `${l.pctRl.toFixed(0)}%`}</td>,
          <td key="c" className="px-3 py-2.5 text-right tabular-nums text-muted">{valor(l.comparacaoCent)}</td>,
          <td key="d" className={cn("px-3 py-2.5 text-right tabular-nums", TOM_DELTA[tomDelta])}>
            {Math.abs(l.deltaCent) < 100 ? "—" : valor(l.deltaCent)}
          </td>,
        ]
      : [
          <td key="v" className="px-3 py-2.5 text-right tabular-nums">{valor(l.valorCent)}</td>,
          <td key="pct" className="px-3 py-2.5 text-right tabular-nums text-muted">{l.pctRl === null ? "—" : `${l.pctRl.toFixed(0)}%`}</td>,
          <td key="c" className="px-3 py-2.5 text-right tabular-nums text-muted">{valor(l.comparacaoCent)}</td>,
          <td key="d" className={cn("px-3 py-2.5 text-right tabular-nums", TOM_DELTA[tomDelta])}>
            {Math.abs(l.deltaCent) < 100 ? "—" : valor(l.deltaCent)}
          </td>,
          <td key="dp" className={cn("px-3 py-2.5 text-right tabular-nums", TOM_DELTA[tomDelta])}>
            {l.deltaPct === null ? "—" : `${l.deltaPct > 0 ? "+" : ""}${l.deltaPct.toFixed(0)}%`}
          </td>,
        ];

  return (
    <tr className={cn("border-b border-line", total && "bg-subtle")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 px-4 py-2.5 text-left font-normal",
          total ? "bg-subtle font-semibold text-ink" : "bg-surface",
          l.nivel === "categoria" && "pl-10 text-muted",
          grupo && "font-semibold text-ink",
        )}
      >
        {grupo ? (
          <button type="button" onClick={onAlternar} className="flex items-center gap-1.5">
            <Chevron className={cn("h-3 w-3 transition-transform", aberto && "rotate-90")} />
            {l.label}
          </button>
        ) : (
          <span className="flex items-center gap-1.5">
            {l.label}
            {l.ajustada && (
              <span title="Ajustado após o fechamento" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
          </span>
        )}
      </th>
      {celulas}
    </tr>
  );
}

function Variacao({ dados }: { dados: Dados }) {
  const v = dados.variacao;
  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-semibold text-ink">O que explica a variação</h2>
      <p className="text-xs text-muted">{v.subtitulo}</p>
      <p className={cn(
        "text-xl font-semibold tracking-tight",
        v.totalCent >= 0 ? "text-emerald-600" : "text-rose-600",
      )}>
        {v.totalCent >= 0 ? "+" : "−"}{brlCheio(Math.abs(v.totalCent))}
      </p>

      {v.itens.length ? (
        <div className="space-y-2">
          {v.itens.map((i) => (
            <div key={i.key} className="rounded-lg border border-line px-3 py-2">
              <p className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-ink">
                  <span className={i.impactoCent >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {i.impactoCent >= 0 ? "▲" : "▼"}
                  </span>
                  {i.label}
                </span>
                <span className={cn(
                  "shrink-0 font-semibold",
                  i.impactoCent >= 0 ? "text-emerald-600" : "text-rose-600",
                )}>
                  {i.impactoCent >= 0 ? "+" : "−"}{brlCheio(Math.abs(i.impactoCent))}
                </span>
              </p>
              {i.nota && <p className="mt-1 text-[11px] leading-relaxed text-muted">{i.nota}</p>}
            </div>
          ))}
          <p className="flex justify-between px-3 text-xs text-muted">
            <span>Demais linhas</span>
            <span>{v.demaisCent >= 0 ? "+" : "−"}{brlCheio(Math.abs(v.demaisCent))}</span>
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Sem período de comparação: não há o que explicar ainda.
        </p>
      )}
    </Card>
  );
}

function ForaDaDre({ dados }: { dados: Dados }) {
  return (
    <Card className="space-y-2 p-5">
      <h2 className="text-sm font-semibold text-ink">Fora da DRE</h2>
      <p className="flex justify-between text-xs">
        <span className="text-muted">Investimentos do período</span>
        <span className="font-semibold text-ink">{brlCheio(dados.fora.investimentosCent)}</span>
      </p>
      <p className="flex justify-between text-xs">
        <span className="text-muted">Sócios e financiamento</span>
        <span className="font-semibold text-ink">{brlCheio(dados.fora.sociosCent)}</span>
      </p>
      <p className="text-[11px] leading-relaxed text-muted">
        Movimentam o caixa, mas não são receita nem despesa da operação.
      </p>
    </Card>
  );
}

function PonteDoCaixa({ dados }: { dados: Dados }) {
  const p = dados.ponte;
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Do resultado ao caixa</h2>
          <p className="text-xs text-muted">Por que o caixa não variou o mesmo que o resultado.</p>
        </div>
        {/* A prova é o ponto do bloco: sem ela, a cascata é só um desenho. */}
        <span className={cn(
          "text-xs",
          p.semCaixa ? "text-muted" : p.confere ? "text-emerald-600" : "text-rose-600",
        )}>
          {p.semCaixa
            ? "Sem conta marcada como disponível, não há com o que conferir"
            : p.confere
              ? "✓ Confere com a variação do disponível no Caixa"
              : `⚠ Diferença de ${brlCheio(Math.abs(p.diferencaCent))} com o Caixa`}
        </span>
      </div>

      {p.barras.length > 1 ? (
        <div className="flex h-52 gap-2">
          {p.barras.map((b, n) => (
            <div key={`${b.label}-${n}`} className="relative flex-1">
              <span
                className={cn(
                  "absolute left-[12%] right-[12%] rounded-sm",
                  b.tipo === "delta"
                    ? b.valorCent >= 0 ? "bg-emerald-500" : "bg-rose-500"
                    : b.valorCent >= 0 ? "bg-brand-500" : "bg-rose-500",
                )}
                style={{ top: `${b.topoPct}%`, height: `${b.alturaPct}%` }}
              />
              <span
                className={cn(
                  "absolute inset-x-0 text-center text-[11px] font-semibold",
                  b.tipo === "delta"
                    ? b.valorCent >= 0 ? "text-emerald-600" : "text-rose-600"
                    : "text-ink",
                )}
                style={{ top: `calc(${b.topoPct}% - 18px)` }}
              >
                {b.tipo === "delta" && b.valorCent >= 0 ? "+" : ""}{brlCheio(b.valorCent)}
              </span>
              <span className="absolute inset-x-0 bottom-0 text-center text-[11px] leading-tight text-muted">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Sem diferenças entre competência e caixa no período: o resultado e o caixa andaram juntos.
        </p>
      )}
    </Card>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */

function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm font-semibold text-ink">{titulo} ainda não foi migrada</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
        A aba está sendo construída sobre o núcleo transacional. Enquanto isso, a DRE já lê os
        itens dos títulos por competência.
      </p>
    </Card>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="text-xs text-muted">{texto}</p>
    </Card>
  );
}
