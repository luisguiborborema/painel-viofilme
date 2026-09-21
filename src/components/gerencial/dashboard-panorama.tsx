"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import { CAIXA_CAIXA, slideVizinho } from "@/lib/data/dashboard-panorama";
import type { DashboardFinanceiro } from "@/lib/data/dashboard-financeiro-server";
import type {
  PanoramaView, SlideCaixa, SlideGastos, SlideReceita, SlideResultado, VisaoPanorama,
} from "@/lib/data/dashboard-panorama-server";
import { COR_PONTUAL, COR_RECORRENTE } from "./dashboard-pulso";

/**
 * Bloco 5 — Panorama (spec §9).
 *
 * Um quadro, uma visão por vez. A lista de visões vem pronta do servidor, e a
 * tela só percorre — é o que a spec pede por "array de configuração": uma
 * quinta visão é mais um item na lista, não mais um `if` aqui dentro.
 *
 * Cada slide tem a mesma anatomia: leitura à esquerda (título, a conclusão
 * escrita, números-chave, link) e gráfico à direita. A conclusão vem antes do
 * gráfico porque é ela que responde à pergunta.
 */

const TOM_NUMERO: Record<string, string> = {
  bom: "text-emerald-600",
  ruim: "text-rose-600",
  atencao: "text-amber-600",
};

export function DashboardPanorama({ dados }: { dados: DashboardFinanceiro }) {
  const p = dados.panorama;
  // Último slide visto fica lembrado por usuário (§16).
  const [atual, setAtual] = usePersistentState("vio-dash-panorama-slide", 0);
  const total = p.visoes.length;
  const i = total ? Math.min(Math.max(atual, 0), total - 1) : 0;

  if (!total) return null;
  const visao = p.visoes[i];

  return (
    <section aria-labelledby="sec-panorama" data-tour="fin-dash-panorama" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="sec-panorama" className="text-lg font-semibold tracking-tight text-ink">
            Panorama
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Caixa, receita, resultado e custos em leitura rápida. Passe para o lado para ver cada visão.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted">{i + 1} de {total}</span>
          <button
            type="button"
            aria-label="Visão anterior"
            onClick={() => setAtual(slideVizinho(i, -1, total))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-subtle"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima visão"
            onClick={() => setAtual(slideVizinho(i, 1, total))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-subtle"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Visões do panorama" className="flex flex-wrap gap-2">
        {p.visoes.map((v, n) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={n === i}
            onClick={() => setAtual(n)}
            className={cn(
              "h-9 rounded-full border px-4 text-xs font-medium transition-colors",
              n === i
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {v.aba}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {/* A faixa desliza; o quadro não muda de tamanho (§9.1). */}
        <div
          className="flex transition-transform duration-[450ms] ease-[cubic-bezier(0.22,0.8,0.26,1)]"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {p.visoes.map((v) => (
            <div
              key={v.id}
              aria-hidden={v.id !== visao.id}
              className="grid w-full shrink-0 gap-7 p-6 lg:grid-cols-[320px_minmax(0,1fr)]"
            >
              <Leitura visao={v} />
              <Grafico id={v.id} p={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Leitura({ visao }: { visao: VisaoPanorama }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold tracking-tight text-ink">{visao.titulo}</h3>
      <p className="text-sm leading-relaxed text-ink">{visao.frase}</p>
      <dl className="flex flex-col">
        {visao.numeros.map((n) => (
          <div key={n.rotulo} className="flex justify-between gap-3 border-b border-line py-2.5 last:border-0">
            <dt className="text-xs text-muted">{n.rotulo}</dt>
            <dd className={cn("text-sm font-semibold text-ink", n.tom && TOM_NUMERO[n.tom])}>
              {n.valor}
            </dd>
          </div>
        ))}
      </dl>
      <Link href={visao.href} className="text-sm font-medium text-brand-600 hover:underline">
        {visao.linkLabel}
      </Link>
    </div>
  );
}

function Grafico({ id, p }: { id: VisaoPanorama["id"]; p: PanoramaView }) {
  if (id === "caixa") return <GraficoCaixa s={p.caixa} />;
  if (id === "receita") return <GraficoReceita s={p.receita} />;
  if (id === "resultado") return <GraficoResultado s={p.resultado} />;
  return <GraficoGastos s={p.gastos} />;
}

/* ── Slide 1 · linha do caixa ──────────────────────────────────────────── */

function GraficoCaixa({ s }: { s: SlideCaixa }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const g = s.grafico;
  if (!g) {
    return <Vazio texto="Sem lançamentos suficientes para projetar o caixa." />;
  }

  const ponto = sobre != null ? g.pontos[sobre] : null;
  const dia = sobre != null ? s.dias[sobre] : null;
  const menor = s.indiceMenor != null ? g.pontos[s.indiceMenor] : null;
  const { largura, altura, esquerda, topo, base } = CAIXA_CAIXA;
  const larguraUtil = largura - esquerda - 10;

  return (
    <div className="flex flex-col justify-center gap-3">
      <div className="flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 bg-brand-500" />
          Saldo projetado
        </span>
        {s.reservaLabel && (
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-amber-500" />
            {s.reservaLabel}
          </span>
        )}
      </div>

      <div className="relative" onMouseLeave={() => setSobre(null)}>
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          className="w-full"
          role="img"
          aria-label={s.menorLabel ? `Saldo projetado dia a dia, ${s.menorLabel}` : "Saldo projetado dia a dia"}
        >
          {g.grade.map((linha) => (
            <g key={linha.y}>
              <line x1={esquerda} x2={largura - 10} y1={linha.y} y2={linha.y} stroke="var(--color-line)" strokeWidth="1" />
              <text x={esquerda - 8} y={linha.y + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
                {linha.label}
              </text>
            </g>
          ))}
          {g.yReserva != null && (
            <line
              x1={esquerda} x2={largura - 10} y1={g.yReserva} y2={g.yReserva}
              stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4"
            />
          )}
          <path d={g.area} fill="var(--color-brand-500)" fillOpacity="0.1" />
          <path d={g.linha} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" strokeLinejoin="round" />
          {menor && (
            <circle cx={menor.x} cy={menor.y} r="4.5" fill="var(--color-surface)" stroke="#f43f5e" strokeWidth="2" />
          )}
          {ponto && (
            <>
              <line x1={ponto.x} x2={ponto.x} y1={topo} y2={base} stroke="var(--color-muted)" strokeWidth="1" />
              <circle cx={ponto.x} cy={ponto.y} r="4" fill="var(--color-ink)" />
            </>
          )}
        </svg>

        {/* Faixas invisíveis: uma por dia, para o hover pegar sem depender do
            traçado da linha, que é fino demais para mirar. */}
        <div
          className="absolute inset-y-0 flex"
          style={{ left: `${(esquerda / largura) * 100}%`, width: `${(larguraUtil / largura) * 100}%` }}
        >
          {s.dias.map((d, n) => (
            <div key={d.dataIso} className="h-full flex-1" onMouseEnter={() => setSobre(n)} />
          ))}
        </div>

        {dia && ponto && (
          <div
            className="pointer-events-none absolute top-0 w-44 rounded-xl border border-line bg-surface p-2.5 shadow-lg"
            style={{ left: `min(calc(100% - 11rem), max(0px, ${(ponto.x / largura) * 100}% - 5.5rem))` }}
          >
            <p className="text-[11px] text-muted">{dia.dataLabel}</p>
            <p className="text-sm font-semibold text-ink">{dia.saldo}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{dia.nota}</p>
          </div>
        )}

        {s.menorLabel && (
          <p className="mt-1 text-[11px] font-medium text-rose-600">{s.menorLabel}</p>
        )}
      </div>

      {s.notaVencidos && <p className="text-[11px] leading-snug text-muted">{s.notaVencidos}</p>}
    </div>
  );
}

/* ── Slide 2 · composição da receita ───────────────────────────────────── */

function GraficoReceita({ s }: { s: SlideReceita }) {
  return (
    <div className="flex flex-col justify-center gap-5">
      <div className="space-y-2.5">
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-subtle-strong">
          <span className={COR_RECORRENTE} style={{ width: `${s.pctRecorrente}%` }} />
          <span className={COR_PONTUAL} style={{ width: `${s.pctPontual}%` }} />
        </div>
        <div className="flex gap-5 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-sm", COR_RECORRENTE)} />
            Recorrente
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-sm", COR_PONTUAL)} />
            Pontual
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] text-muted">Por serviço contratado</p>
        {s.semServicos ? (
          <p className="text-xs text-muted">Nenhum serviço cadastrado nos clientes ainda.</p>
        ) : (
          s.servicos.map((sv) => (
            <div key={sv.nome} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_84px] items-center gap-3">
              <span className="truncate text-xs text-ink">{sv.nome}</span>
              <span className="flex h-3 gap-0.5">
                <span className={cn("rounded-sm", COR_RECORRENTE)} style={{ width: `${sv.larguraRec}%` }} />
                <span className={cn("rounded-sm", COR_PONTUAL)} style={{ width: `${sv.larguraPon}%` }} />
              </span>
              <span className="text-right text-xs font-semibold text-ink">{sv.total}</span>
            </div>
          ))
        )}
      </div>

      {s.pontuais.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-[11px] text-muted">Maiores pontuais do mês</p>
          {s.pontuais.map((p) => (
            <div key={p.nome} className="flex justify-between gap-3 text-xs">
              <span className="truncate text-ink">{p.nome}</span>
              <span className="shrink-0 font-medium text-ink">{p.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Slide 3 · resultado em 6 meses ────────────────────────────────────── */

function GraficoResultado({ s }: { s: SlideResultado }) {
  if (!s.meses.length) return <Vazio texto="Ainda não há histórico de resultado." />;

  return (
    <div className="flex flex-col justify-center gap-4">
      <div className="flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
          Receita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
          Custos, despesas e impostos
        </span>
      </div>
      <div
        className="grid items-end gap-2"
        style={{ gridTemplateColumns: `repeat(${s.meses.length}, minmax(0, 1fr))` }}
      >
        {s.meses.map((m) => (
          <div key={m.label} className="flex flex-col gap-1.5">
            <div className="flex h-44 items-end justify-center gap-1">
              <div
                className={cn(
                  "w-6 rounded-t",
                  // O mês em curso vem hachurado: metade do mês não é o mês.
                  m.emCurso
                    ? "bg-[repeating-linear-gradient(135deg,var(--color-brand-500)_0_4px,transparent_4px_7px)] ring-1 ring-inset ring-brand-500"
                    : "bg-brand-500",
                )}
                style={{ height: `${m.alturaReceita}%` }}
              />
              <div className="w-6 rounded-t bg-slate-400" style={{ height: `${m.alturaSaidas}%` }} />
            </div>
            <span className="truncate text-center text-[11px] text-muted">{m.label}</span>
            <span className="text-center text-xs font-semibold text-ink">{m.resultado}</span>
            <span className="text-center text-[10px] text-muted">{m.margem}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Slide 4 · para onde vai o dinheiro ────────────────────────────────── */

function GraficoGastos({ s }: { s: SlideGastos }) {
  if (!s.grupos.length) return <Vazio texto="Nenhuma saída lançada neste mês." />;

  return (
    <div className="flex flex-col justify-center gap-4">
      {s.grupos.map((g) => (
        <div key={g.nome} className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_88px_40px] items-center gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs text-ink">{g.nome}</span>
            {g.seloOrcado && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-600">
                {g.seloOrcado}
              </span>
            )}
          </span>
          <span className="h-3 rounded-sm bg-subtle-strong">
            <span
              className={cn("block h-full rounded-sm", g.acimaDoOrcado ? "bg-amber-500" : "bg-slate-400")}
              style={{ width: `${g.largura}%` }}
            />
          </span>
          <span className="text-right text-xs font-semibold text-ink">{g.valor}</span>
          <span className="text-right text-[11px] text-muted">{g.pct}</span>
        </div>
      ))}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-line px-5 text-center text-sm text-muted">
      {texto}
    </div>
  );
}
