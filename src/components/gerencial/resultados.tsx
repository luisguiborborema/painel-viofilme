"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Chevron, Download, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type {
  LinhaDre, LinhaRentabilidade, ResultadosView as Dados,
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
          {aba === "rentabilidade" && <AbaRentabilidade dados={dados} irPara={irPara} />}
          {aba === "receita" && <AbaReceita dados={dados} />}
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
  const [lancamentos, setLancamentos] = useState<{ cat: string; mes?: string } | null>(null);

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
                    onAbrirLancamentos={(mes) =>
                      setLancamentos({ cat: l.key.split(":").slice(1).join(":"), mes })}
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

      {lancamentos && (
        <DrawerLancamentos
          cat={lancamentos.cat}
          mes={lancamentos.mes}
          dados={dados}
          onFechar={() => setLancamentos(null)}
        />
      )}
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
  l, dados, aberto, onAlternar, onAbrirLancamentos,
}: {
  l: LinhaDre; dados: Dados; aberto: boolean; onAlternar: () => void;
  onAbrirLancamentos: (mes?: string) => void;
}) {
  const total = l.nivel === "total";
  const grupo = l.nivel === "grupo";
  const negativo = l.sinal === -1;

  // Custo aumentar é ruim; receita aumentar é bom. É a mesma regra do delta
  // invertido do Portal, e sem ela a DRE pinta de verde uma despesa crescendo.
  const tomDelta = Math.abs(l.deltaCent) < 100
    ? "neutro" : (negativo ? l.deltaCent < 0 : l.deltaCent > 0) ? "bom" : "ruim";

  const valor = (c: number) => (c === 0 ? "—" : brlCheio(negativo ? -c : c).replace("R$ ", ""));

  // Só categoria abre lançamentos: grupo e total são somas, não lançamento.
  const abrivel = l.clicavel;
  const celulas = dados.modo === "evo"
    ? l.meses.map((m) => (
        <td key={m.mes} className="px-3 py-2.5 text-right tabular-nums">
          <button
            type="button"
            disabled={!abrivel || m.valorCent === 0}
            onClick={() => onAbrirLancamentos(m.mes.slice(0, 7))}
            className={cn("block w-full text-right", abrivel && m.valorCent !== 0 && "hover:text-brand-600")}
          >
            <span className="block">{valor(m.valorCent)}</span>
            {m.pctRl !== null && m.valorCent !== 0 && (
              <span className="block text-[10px] text-muted">{m.pctRl.toFixed(0)}%</span>
            )}
          </button>
        </td>
      ))
    : dados.mesAberto
      ? [
          <td key="r" className="px-3 py-2.5 text-right tabular-nums">{l.nivel === "categoria" ? valor(l.realizadoCent) : ""}</td>,
          <td key="p" className="px-3 py-2.5 text-right tabular-nums text-muted">{l.nivel === "categoria" ? valor(l.previstoCent) : ""}</td>,
          <td key="t" className="px-3 py-2.5 text-right tabular-nums">
            {abrivel ? (
              <button type="button" onClick={() => onAbrirLancamentos()} className="hover:text-brand-600">
                {valor(l.valorCent)}
              </button>
            ) : valor(l.valorCent)}
          </td>,
          <td key="pct" className="px-3 py-2.5 text-right tabular-nums text-muted">{l.pctRl === null ? "—" : `${l.pctRl.toFixed(0)}%`}</td>,
          <td key="c" className="px-3 py-2.5 text-right tabular-nums text-muted">{valor(l.comparacaoCent)}</td>,
          <td key="d" className={cn("px-3 py-2.5 text-right tabular-nums", TOM_DELTA[tomDelta])}>
            {Math.abs(l.deltaCent) < 100 ? "—" : valor(l.deltaCent)}
          </td>,
        ]
      : [
          <td key="v" className="px-3 py-2.5 text-right tabular-nums">
            {abrivel ? (
              <button type="button" onClick={() => onAbrirLancamentos()} className="hover:text-brand-600">
                {valor(l.valorCent)}
              </button>
            ) : valor(l.valorCent)}
          </td>,
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
        <div className="flex h-56 gap-2">
          {p.barras.map((b, n) => (
            <div key={`${b.label}-${n}`} className="relative flex-1">
              {/* A área da barra para 28px acima do fim: sem isso, uma barra
                  alta cobre o próprio rótulo e o gráfico fica ilegível. */}
              <span className="absolute inset-x-0 top-5 bottom-7">
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
                  style={{ top: `calc(${b.topoPct}% - 17px)` }}
                >
                  {b.tipo === "delta" && b.valorCent >= 0 ? "+" : ""}{brlCheio(b.valorCent)}
                </span>
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

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="text-xs text-muted">{texto}</p>
    </Card>
  );
}

/* ── Aba Rentabilidade (§6) ────────────────────────────────────────────── */

const TOM_SAUDE: Record<string, string> = {
  saudavel: "bg-emerald-500/15 text-emerald-600",
  atencao: "bg-amber-500/15 text-amber-600",
  critica: "bg-rose-500/15 text-rose-600",
  "sem-dados": "bg-subtle text-muted",
};

const DIMENSOES = [
  { key: "clientes", label: "Clientes" },
  { key: "servicos", label: "Serviços" },
  { key: "projetos", label: "Projetos" },
  { key: "squads", label: "Squads" },
];

function AbaRentabilidade({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const r = dados.rentabilidade;
  const [como, setComo] = useState(false);

  return (
    <section aria-label="Rentabilidade" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
          {DIMENSOES.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => irPara({ dim: d.key })}
              aria-pressed={r.dimensao === d.key}
              className={cn(
                "h-8 rounded-lg px-3.5 text-xs font-medium transition-colors",
                r.dimensao === d.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setComo((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:underline">
          Como é calculado
        </button>
      </div>

      {como && (
        <Card className="p-4 text-xs leading-relaxed text-muted">
          Margem de contribuição = receita − deduções proporcionais (alíquota efetiva do período)
          − equipe alocada − custos diretos vinculados. A equipe entra por vagas: o custo do
          colaborador dividido pela capacidade dele (ou pelo número real de vagas, se passar da
          capacidade). Vagas livres viram capacidade ociosa e não são distribuídas. A estrutura
          — pró-labore, administrativo, softwares — também não é distribuída: ratear estrutura
          por critério arbitrário produz número que leva a cortar o cliente que ajudava a pagá-la.
        </Card>
      )}

      <Prova prova={r.prova} />

      {r.alertas.map((a, n) => (
        <Card key={n} className="flex flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/5 px-4 py-3">
          <span className="flex-1 text-xs text-ink">{a.texto}</span>
          <span className="text-xs text-muted">{a.cta}</span>
        </Card>
      ))}

      {r.lacunas.length > 0 && (
        <Card className="space-y-1 border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-600">
            O que falta para esta aba responder de verdade
          </p>
          {r.lacunas.map((l, n) => (
            <p key={n} className="text-xs text-muted">{l}</p>
          ))}
        </Card>
      )}

      {r.matriz.pontos.length > 0 && <Matriz dados={dados} />}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_100px_110px_120px_120px_90px_70px_110px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>{DIMENSOES.find((d) => d.key === r.dimensao)?.label.replace(/s$/, "") ?? "Cliente"}</span>
          <span className="text-right">Receita</span><span className="text-right">Deduções</span>
          <span className="text-right">Equipe</span><span className="text-right">Custos diretos</span>
          <span className="text-right">Margem</span><span className="text-right">Margem %</span>
          <span className="text-right">Vagas</span><span>Saúde</span>
        </div>
        <ul className="m-0 list-none p-0">
          {r.linhas.map((l) => <LinhaRent key={l.id} l={l} />)}
        </ul>

        {!r.linhas.length && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-11 text-center">
            <p className="text-sm font-medium text-ink">Nada para medir neste período</p>
            <p className="max-w-lg text-xs text-muted">
              A margem por {r.dimensao === "clientes" ? "cliente" : r.dimensao.replace(/s$/, "")} precisa
              de receita com essa dimensão no item. Sem isso, a página não tem o que dividir.
            </p>
          </div>
        )}

        {r.linhas.length > 0 && (
          <div className="space-y-1 border-t border-line bg-subtle px-5 py-3 text-xs">
            <p className="flex justify-between font-semibold text-ink">
              <span>Carteira</span>
              <span>{brlCheio(r.rodape.carteira.margemCent)}
                {r.rodape.carteira.margemPct !== null && ` · ${r.rodape.carteira.margemPct}%`}</span>
            </p>
            <p className="flex justify-between text-muted">
              <span>Operação geral <span className="text-[11px]">(custo direto sem cliente)</span></span>
              <span>−{brlCheio(r.rodape.operacaoGeralCent)}</span>
            </p>
            <p className="flex justify-between text-amber-600">
              <span>Capacidade ociosa <span className="text-[11px]">(vagas livres)</span></span>
              <span>−{brlCheio(r.rodape.ociosidadeCent)}</span>
            </p>
          </div>
        )}
      </Card>

      {r.ocupacao.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-ink">Ocupação por função</h2>
          <p className="text-xs text-muted">
            Onde está o gargalo antes de contratar, e onde há espaço para vender.
          </p>
          {r.ocupacao.map((o) => (
            <div key={o.funcao} className="grid items-center gap-3 lg:grid-cols-[170px_minmax(0,1fr)_150px_170px]">
              <span className="text-xs font-medium text-ink">{o.funcao}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-subtle-strong">
                <span
                  className={cn("block h-full",
                    o.pct > 100 ? "bg-rose-500" : o.pct >= 90 ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, o.pct)}%` }}
                />
              </span>
              <span className={cn("text-xs font-semibold",
                o.pct > 100 ? "text-rose-600" : o.pct >= 90 ? "text-amber-600" : "text-emerald-600")}>
                {o.usadas} de {o.capacidade} vagas ({o.pct}%)
              </span>
              <span className="text-xs text-muted">{o.estado}</span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function Prova({ prova }: { prova: Dados["rentabilidade"]["prova"] }) {
  const parte = (label: string, valor: number, op: string) => (
    <span key={label} className="flex items-center gap-3">
      <span className="flex flex-col">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="text-base font-semibold text-ink">{brlCheio(valor)}</span>
      </span>
      <span className="text-base text-muted">{op}</span>
    </span>
  );

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
      {parte("Margem de contribuição", prova.margemClientesCent, "−")}
      {parte("Capacidade ociosa", prova.ociosidadeCent, "−")}
      {parte("Operação geral", prova.operacaoGeralCent, "−")}
      {parte("Estrutura", prova.estruturaCent, prova.financeiroCent >= 0 ? "+" : "−")}
      {parte("Financeiro", Math.abs(prova.financeiroCent), "=")}
      <span className="flex flex-col">
        <span className="text-[11px] text-muted">Resultado líquido</span>
        <span className="text-base font-semibold text-brand-600">{brlCheio(prova.resultadoCent)}</span>
      </span>
      <span className="flex-1" />
      {/* A prova é o motivo de a aba existir junto da DRE: divergência é bug. */}
      <span className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        prova.confere ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600",
      )}>
        {prova.confere
          ? "✓ Confere com a DRE"
          : `⚠ Diferença de ${brlCheio(Math.abs(prova.diferencaCent))} com a DRE`}
      </span>
      {!prova.confere && prova.causas.length > 0 && (
        <span className="w-full text-xs text-muted">
          Causas prováveis: {prova.causas.join("; ")}.
        </span>
      )}
    </Card>
  );
}

function LinhaRent({ l }: { l: LinhaRentabilidade }) {
  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_110px_100px_110px_120px_120px_90px_70px_110px]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink">{l.nome}</span>
        <span className="truncate text-[11px] text-muted">
          {l.aviso ? <span className="text-amber-600">{l.aviso}</span> : l.detalhe}
        </span>
      </span>
      <span className="text-right text-sm text-ink">{brlCheio(l.receitaCent)}</span>
      <span className="text-right text-sm text-muted">−{brlCheio(l.deducoesCent)}</span>
      <span className="text-right text-sm text-muted">−{brlCheio(l.equipeCent)}</span>
      <span className="text-right text-sm text-muted">−{brlCheio(l.custosDiretosCent)}</span>
      <span className={cn("text-right text-sm font-semibold",
        l.margemCent >= 0 ? "text-ink" : "text-rose-600")}>
        {brlCheio(l.margemCent)}
      </span>
      <span className="text-right text-sm font-semibold text-ink">
        {l.margemPct === null ? "—" : `${l.margemPct}%`}
      </span>
      <span className="text-right text-xs text-muted">{l.vagas || "—"}</span>
      <span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_SAUDE[l.saude])}>
          {l.saudeLabel}
        </span>
      </span>
    </li>
  );
}

function Matriz({ dados }: { dados: Dados }) {
  const m = dados.rentabilidade.matriz;
  const cor: Record<string, string> = {
    saudavel: "border-emerald-500 bg-emerald-500/20",
    atencao: "border-amber-500 bg-amber-500/20",
    critica: "border-rose-500 bg-rose-500/20",
    "sem-dados": "border-line bg-subtle",
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Matriz de rentabilidade</h2>
        <span className="text-xs text-muted">
          Receita no período × margem. Tamanho do ponto: vagas de equipe consumidas.
        </span>
      </div>

      <div className="relative h-80 rounded-xl border border-line bg-subtle">
        <span className="absolute left-2 top-2 text-[10px] font-semibold text-emerald-600">EFICIENTES</span>
        <span className="absolute right-2 top-2 text-[10px] font-semibold text-emerald-600">PILARES</span>
        <span className="absolute left-2 bottom-2 text-[10px] font-semibold text-rose-600">ATENÇÃO</span>
        <span className="absolute right-2 bottom-2 text-[10px] font-semibold text-amber-600">
          REVER ESCOPO OU PREÇO
        </span>

        <span className="absolute inset-y-0 border-l border-dashed border-line"
          style={{ left: `${m.mediaReceitaX}%` }} />
        <span className="absolute inset-x-0 border-t border-dashed border-line"
          style={{ top: `${m.mediaMargemY}%` }} />
        <span className="absolute inset-x-0 border-t border-rose-500/40"
          style={{ top: `${m.zeroY}%` }} />

        {m.pontos.map((p) => (
          <span key={p.id} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span
              title={`${p.nome}: ${brlCheio(p.receitaCent)}, margem ${p.margemPct}%`}
              className={cn("block rounded-full border-2", cor[p.saude])}
              style={{ width: p.tamanho, height: p.tamanho, marginLeft: -p.tamanho / 2, marginTop: -p.tamanho / 2 }}
            />
            {p.comRotulo && (
              <span className="absolute left-4 top-[-8px] whitespace-nowrap text-[10px] text-muted">
                {p.nome}
              </span>
            )}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ── Aba Receita (§7) ──────────────────────────────────────────────────── */

function AbaReceita({ dados }: { dados: Dados }) {
  const r = dados.receita;
  return (
    <section aria-label="Receita" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {r.indicadores.map((i) => (
          <Card key={i.key} className="flex flex-col gap-1 p-4">
            <span className="text-[11px] text-muted">{i.label}</span>
            <span className={cn("text-lg font-semibold tracking-tight",
              i.deltaTom === "ruim" && i.key === "churn" ? "text-rose-600" : "text-ink")}>
              {i.valor}
            </span>
            <span className="text-[11px] text-muted">{i.contexto}</span>
          </Card>
        ))}
      </div>

      {r.lacunas.length > 0 && (
        <Card className="space-y-1 border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-600">O que ainda não existe nesta aba</p>
          {r.lacunas.map((l, n) => <p key={n} className="text-xs text-muted">{l}</p>)}
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Ponte do MRR</h2>
            <p className="text-xs text-muted">{r.ponteMrrSub}</p>
          </div>
          {r.ponteMrr.length > 2 ? (
            <div className="flex h-56 gap-2">
              {r.ponteMrr.map((b, n) => (
                <div key={`${b.label}-${n}`} className="relative flex-1">
                  <span className="absolute inset-x-0 top-5 bottom-7">
                    <span
                      className={cn("absolute left-[12%] right-[12%] rounded-sm",
                        b.tipo === "delta"
                          ? b.label === "Pausas" ? "bg-slate-400"
                            : b.valorCent >= 0 ? "bg-emerald-500" : "bg-rose-500"
                          : "bg-brand-500")}
                      style={{ top: `${b.topoPct}%`, height: `${b.alturaPct}%` }}
                    />
                    <span className="absolute inset-x-0 text-center text-[11px] font-semibold text-ink"
                      style={{ top: `calc(${b.topoPct}% - 17px)` }}>
                      {b.tipo === "delta" && b.valorCent >= 0 ? "+" : ""}{brlCheio(b.valorCent)}
                    </span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 text-center text-[11px] text-muted">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">
              Sem recorrências ativas e sem movimentos no período, a ponte não tem de onde sair.
            </p>
          )}
        </Card>

        <Card className="space-y-2 p-5">
          <h2 className="text-sm font-semibold text-ink">Movimentos do período</h2>
          {r.movimentos.length ? (
            r.movimentos.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  m.tom === "bom" ? "bg-emerald-500/15 text-emerald-600"
                    : m.tom === "ruim" ? "bg-rose-500/15 text-rose-600" : "bg-subtle text-muted")}>
                  {m.tipoLabel}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{m.cliente}</span>
                  <span className="block truncate text-[11px] text-muted">{m.motivo}</span>
                </span>
                <span className={cn("text-xs font-semibold",
                  m.valorCent >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {m.valorCent >= 0 ? "+" : "−"}{brlCheio(Math.abs(m.valorCent))}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted">
              Nenhum movimento de MRR registrado no período.
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Evolução em 12 meses</h2>
          <p className="text-xs text-muted">Barras: receita do mês, separando recorrente de pontual.</p>
        </div>
        <div className="flex h-52 items-end gap-2">
          {dados.receita.evolucao.map((m) => (
            // `h-full` não é decoração: altura em % só resolve contra um pai
            // com altura definida, e sem ela as barras somem.
            <div key={m.mes} className={cn("flex h-full flex-1 flex-col justify-end gap-px",
              m.noPeriodo && "rounded-t bg-brand-500/5")}
              title={`${m.label}: ${brlCheio(m.recorrenteCent + m.pontualCent)}`}>
              <span className="bg-sky-400" style={{ height: `${m.alturaPon}%` }} />
              <span className="bg-brand-500" style={{ height: `${m.alturaRec}%` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {dados.receita.evolucao.map((m) => (
            <span key={m.mes} className={cn("flex-1 text-center text-[10px]",
              m.noPeriodo ? "font-semibold text-ink" : "text-muted")}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />Recorrente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" />Pontual
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Concentração</h2>
            <p className={cn("text-xs", r.concentracao.alerta ? "text-amber-600" : "text-muted")}>
              {r.concentracao.nota}
            </p>
          </div>
          {r.concentracao.linhas.map((c) => (
            <div key={c.nome} className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_120px_60px_60px]">
              <span className="truncate text-xs text-ink">{c.nome}</span>
              <span className="h-2 overflow-hidden rounded-full bg-subtle-strong">
                <span className={cn("block h-full", c.acima ? "bg-rose-500" : "bg-brand-500")}
                  style={{ width: `${Math.min(100, c.pct)}%` }} />
              </span>
              <span className="text-right text-xs font-semibold text-ink">{c.pct}%</span>
              <span className="text-right text-[11px] text-muted">{c.acumuladoPct}%</span>
            </div>
          ))}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Receita por serviço</h2>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_100px_60px] gap-2 border-y border-line bg-subtle px-5 py-2 text-[11px] text-muted">
            <span>Serviço</span><span className="text-right">Recorrente</span>
            <span className="text-right">Pontual</span><span className="text-right">Total</span>
            <span className="text-right">%</span>
          </div>
          {r.porServico.map((s) => (
            <div key={s.nome} className="grid grid-cols-[minmax(0,1fr)_100px_100px_100px_60px] gap-2 border-b border-line px-5 py-2.5 text-xs">
              <span className="truncate font-medium text-ink">{s.nome}</span>
              <span className="text-right text-muted">{brlCheio(s.recorrenteCent)}</span>
              <span className="text-right text-muted">{brlCheio(s.pontualCent)}</span>
              <span className="text-right font-semibold text-ink">{brlCheio(s.totalCent)}</span>
              <span className="text-right text-muted">{s.pct}%</span>
            </div>
          ))}
          {!r.porServico.length && (
            <p className="px-5 py-8 text-center text-xs text-muted">
              Nenhum item de receita no período.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}

/* ── Drawer de lançamentos (§8.1) ──────────────────────────────────────── */

type Lancamentos = {
  titulo: string; periodoLabel: string; totalCent: number;
  itens: { mes: string; descricao: string; valorCent: number; realizadoCent: number }[];
  nota: string | null;
};

function DrawerLancamentos({
  cat, mes, dados, onFechar,
}: { cat: string; mes?: string; dados: Dados; onFechar: () => void }) {
  const [d, setD] = useState<Lancamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ cat, gran: dados.periodo.gran, periodo: dados.periodo.iso });
    if (mes) q.set("mes", mes);
    fetch(`/api/gerencial/resultados/lancamentos?${q}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok) setErro(j?.error ?? "Não foi possível abrir os lançamentos.");
        else setD(j as Lancamentos);
      })
      .catch(() => vivo && setErro("Não foi possível abrir os lançamentos."));
    return () => { vivo = false; };
  }, [cat, mes, dados.periodo.gran, dados.periodo.iso]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/50" />
      <aside
        aria-label="Lançamentos"
        className="relative flex h-full w-full max-w-[540px] flex-col border-l border-line bg-surface"
      >
        <header className="space-y-1 border-b border-line px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted">{d?.periodoLabel ?? dados.periodo.label}</span>
            <button type="button" aria-label="Fechar" onClick={onFechar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-ink">{d?.titulo ?? "Lançamentos"}</h2>
          <p className="text-2xl font-semibold tracking-tight text-ink">
            {brlCheio(d?.totalCent ?? 0)}
          </p>
          <p className="text-xs text-muted">
            {d ? `${d.itens.length} ${d.itens.length === 1 ? "item" : "itens"}, por competência` : ""}
          </p>
        </header>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-6 py-4">
          {erro && <p className="text-sm text-muted">{erro}</p>}
          {d?.itens.map((i, n) => (
            <div key={n} className="grid grid-cols-[56px_minmax(0,1fr)_110px] items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs">
              <span className="text-muted">{i.mes}</span>
              <span className="truncate text-ink">{i.descricao}</span>
              <span className="text-right font-semibold text-ink">{brlCheio(i.valorCent)}</span>
            </div>
          ))}
          {d && !d.itens.length && (
            <p className="text-xs text-muted">Nenhum lançamento nesta categoria no período.</p>
          )}
          {d?.nota && <p className="pt-2 text-[11px] leading-relaxed text-muted">{d.nota}</p>}
        </div>
      </aside>
    </div>
  );
}
