"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUp, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type { DashboardFinanceiro, LancamentoSemana } from "@/lib/data/dashboard-financeiro-server";
import type { AlvoFicha } from "./dashboard-ficha";

/**
 * Bloco 4 — Esta semana (spec §8).
 *
 * O quadro tem altura fixa e rola por dentro: com 3 ou com 30 lançamentos a
 * página mede o mesmo, e o Panorama logo abaixo não muda de lugar a cada
 * baixa. Vencidos não entram — já estão no Bloco 1.
 */

const TOM: Record<LancamentoSemana["situacaoTom"], string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  neutro: "bg-subtle text-muted",
};

type Filtro = "todas" | "in" | "out";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "in", label: "Entradas" },
  { key: "out", label: "Saídas" },
];

/** 7 linhas de 56px: a altura que a spec fixa para o quadro. */
const ALTURA_LISTA = 7 * 56;

/**
 * As colunas do §8.2. Escritas por extenso nos dois lugares de propósito: o
 * Tailwind lê o código-fonte, então classe montada por concatenação não chega
 * a existir no CSS — e o grid silenciosamente vira uma coluna só.
 */
const COLUNAS_CABECALHO = "grid-cols-[64px_24px_minmax(0,1fr)_132px_96px_110px_150px]";
const COLUNAS_LINHA = "lg:grid-cols-[64px_24px_minmax(0,1fr)_132px_96px_110px_150px]";

export function DashboardSemana({
  dados,
  onAbrirFicha,
  onMudou,
}: {
  dados: DashboardFinanceiro;
  onAbrirFicha: (alvo: AlvoFicha) => void;
  onMudou: () => void;
}) {
  // Preferência de UI, por usuário e por dispositivo (§16).
  const [filtro, setFiltro] = usePersistentState<Filtro>("vio-dash-semana-filtro", "todas");

  const visiveis = dados.semana.lancamentos.filter(
    (l) => filtro === "todas" || l.direcao === filtro,
  );
  const entra = visiveis.filter((l) => l.direcao === "in").reduce((s, l) => s + l.valorCent, 0);
  const sai = visiveis.filter((l) => l.direcao === "out").reduce((s, l) => s + l.valorCent, 0);

  return (
    <section aria-labelledby="sec-semana" data-tour="fin-dash-semana" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="sec-semana" className="text-lg font-semibold tracking-tight text-ink">
            Esta semana
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Cada entrada e saída de hoje até {dados.semana.ateLabel}, com a ação ao lado.
          </p>
        </div>
        <div
          role="group"
          aria-label="Filtrar direção"
          className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1"
        >
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              aria-pressed={filtro === f.key}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                filtro === f.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div
          className={cn(
            "hidden gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid",
            COLUNAS_CABECALHO,
          )}
        >
          <span>Data</span>
          <span />
          <span>Pessoa e descrição</span>
          <span>Situação</span>
          <span>Conta</span>
          <span className="text-right">Valor</span>
          <span />
        </div>

        <ul
          className="m-0 list-none overflow-y-auto p-0"
          style={{ height: ALTURA_LISTA }}
        >
          {visiveis.map((l) => (
            <Linha key={`${l.direcao}-${l.id}`} l={l} onAbrirFicha={onAbrirFicha} onMudou={onMudou} />
          ))}
          {!visiveis.length && (
            // O quadro mantém a altura (o Panorama abaixo não pode pular a
            // cada baixa), mas o vazio fica centrado: uma frase encostada no
            // topo de 392px de nada parece tela quebrada.
            <li className="flex h-full items-center justify-center px-5 text-center text-sm text-muted">
              Nada previsto para esta semana neste filtro.
            </li>
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-5 py-3">
          <span className="text-xs text-muted">
            {visiveis.length} {visiveis.length === 1 ? "lançamento" : "lançamentos"}
            <span className="mx-3 inline-block" />
            Entra <span className="font-semibold text-emerald-600">{brlCheio(entra)}</span>
            <span className="mx-2 inline-block" />
            Sai <span className="font-semibold text-ink">{brlCheio(sai)}</span>
          </span>
          <Link
            href="/gerencial/financeiro?aba=fluxo"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Abrir no fluxo de caixa
          </Link>
        </div>
      </div>
    </section>
  );
}

function Linha({
  l,
  onAbrirFicha,
  onMudou,
}: {
  l: LancamentoSemana;
  onAbrirFicha: (alvo: AlvoFicha) => void;
  onMudou: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const entrada = l.direcao === "in";

  async function aprovar() {
    setOcupado(true);
    const res = await fetch("/api/gerencial/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", id: l.id }),
    }).catch(() => null);
    setOcupado(false);
    const j = await res?.json().catch(() => null);
    if (!res?.ok) {
      toast(j?.error ?? "Não foi possível aprovar.");
      return;
    }
    toast(`Despesa aprovada: ${l.pessoa}.`, "success");
    onMudou();
  }

  return (
    <li
      className={cn(
        "grid items-center gap-3 border-b border-line px-5 transition-colors hover:bg-subtle",
        "grid-cols-[1fr_auto] py-3 lg:py-0",
        COLUNAS_LINHA,
      )}
      style={{ minHeight: 56 }}
    >
      <span
        className={cn(
          "hidden text-xs lg:block",
          l.hoje ? "font-semibold text-ink" : "text-muted",
        )}
      >
        {l.dataLabel}
      </span>
      <span
        aria-label={entrada ? "Entrada" : "Saída"}
        className={cn(
          "hidden h-6 w-6 shrink-0 items-center justify-center rounded-full lg:flex",
          entrada ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle-strong text-muted",
        )}
      >
        <ArrowUp className={cn("h-3.5 w-3.5", !entrada && "rotate-180")} />
      </span>

      <button
        type="button"
        onClick={() => onAbrirFicha({ id: l.id, direcao: l.direcao })}
        className="flex min-w-0 flex-col items-start text-left lg:flex-row lg:items-baseline lg:gap-2.5"
      >
        <span className="truncate text-sm font-semibold text-ink">{l.pessoa}</span>
        {/* Sem cliente ou fornecedor cadastrado, o nome JÁ é a descrição —
            repeti-la ao lado parece defeito de renderização. */}
        {l.descricao !== l.pessoa && (
          <span className="truncate text-xs text-muted">{l.descricao}</span>
        )}
        <span className="text-[11px] text-muted lg:hidden">{l.dataLabel} · {l.conta}</span>
      </button>

      <span className="hidden lg:block">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[l.situacaoTom])}>
          {l.situacao}
        </span>
      </span>
      <span className="hidden truncate text-xs text-muted lg:block">{l.conta}</span>
      <span
        className={cn(
          "text-right text-sm font-semibold",
          entrada ? "text-emerald-600" : "text-ink",
        )}
      >
        {entrada ? "+ " : "− "}
        {brlCheio(l.valorCent)}
      </span>

      <span className="col-span-2 flex justify-end lg:col-span-1">
        {l.acao === "aprovar" ? (
          <button
            type="button"
            onClick={aprovar}
            disabled={ocupado}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-subtle-strong disabled:opacity-50"
          >
            {ocupado && <Loader2 className="h-3 w-3 animate-spin" />}
            {l.acaoLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAbrirFicha({ id: l.id, direcao: l.direcao })}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-subtle-strong"
          >
            {l.acao === "ver-cobranca" && <ExternalLink className="h-3 w-3" />}
            {l.acaoLabel}
          </button>
        )}
      </span>
    </li>
  );
}
