"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { brlCheio, brlComSinal } from "@/lib/data/dashboard-financeiro";
import type { ContaNoPopover, DashboardFinanceiro } from "@/lib/data/dashboard-financeiro-server";

/**
 * Bloco 2 — Pulso (spec §6): quatro cartões que respondem "a empresa está
 * saudável agora?". Nenhum deles calcula nada: tudo chega pronto do servidor.
 *
 * As duas cores da receita vivem aqui porque a spec (§6.2) exige que o
 * Panorama da Parte 2 use exatamente as mesmas — recorrente e pontual trocando
 * de cor entre dois blocos da mesma página seria a pior forma de explicar a
 * diferença entre os dois.
 */
export const COR_RECORRENTE = "bg-brand-500";
export const COR_PONTUAL = "bg-sky-400";
export const TEXTO_RECORRENTE = "text-brand-600";
export const TEXTO_PONTUAL = "text-sky-500";

const DICIONARIO = {
  saldo:
    "Soma das contas que compõem o dinheiro disponível hoje. Reserva e investimento ficam de fora.",
  caixa30:
    "Saldo de hoje mais o que está previsto entrar até lá, menos o que está previsto sair. Recebimento vencido não entra; pagamento vencido entra como saída de hoje.",
  resultado:
    "Receita menos custos e despesas do mês, por competência: cada valor pertence ao mês em que venceu, não ao mês em que foi pago.",
  receita:
    "MRR é a receita contratada que se repete todo mês. Pontual é o que foi faturado no mês fora de contrato recorrente.",
};

export function DashboardPulso({ dados }: { dados: DashboardFinanceiro }) {
  return (
    <section
      aria-label="Pulso"
      data-tour="fin-dash-pulso"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <CardSaldo dados={dados} />
      <CardCaixa30 dados={dados} />
      <CardResultado dados={dados} />
      <CardReceita dados={dados} />
    </section>
  );
}

/* ── Casca comum ───────────────────────────────────────────────────────── */

function Casca({
  titulo,
  dica,
  href,
  children,
  extra,
}: {
  titulo: string;
  dica: string;
  href?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const corpo = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {titulo}
        <span title={dica} className="text-muted/70">
          <Info className="h-3.5 w-3.5" />
        </span>
        {extra}
      </span>
      {children}
    </>
  );
  const classe =
    "flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand-300";

  return href ? (
    <Link href={href} className={classe}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

const NUMERO = "text-[27px] font-semibold leading-none tracking-tight text-ink";

/* ── Saldo disponível (§6.1) ───────────────────────────────────────────── */

function CardSaldo({ dados }: { dados: DashboardFinanceiro }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const { saldo } = dados;

  // Fechar ao clicar fora: o popover cobre o cartão vizinho, e deixá-lo
  // preso na tela esconde o "Caixa em 30 dias" sem que ninguém peça.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const folego =
    saldo.folegoMeses == null
      ? "Sem saídas suficientes para calcular o fôlego"
      // Saldo negativo não tem fôlego "negativo": não tem fôlego nenhum. A
      // conta devolve −2,2 meses, que é aritmética correta e frase sem
      // sentido — e a leitura errada aqui é tranquilizadora.
      : saldo.totalCent <= 0
        ? "Sem fôlego: o disponível está zerado ou negativo"
        : `Cerca de ${saldo.folegoMeses.toLocaleString("pt-BR", {
            minimumFractionDigits: 1, maximumFractionDigits: 1,
          })} ${saldo.folegoMeses < 2 ? "mês" : "meses"} de fôlego`;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex h-full w-full flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand-300"
      >
        <span className="flex w-full items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5">
            Saldo disponível
            <span title={DICIONARIO.saldo} className="text-muted/70">
              <Info className="h-3.5 w-3.5" />
            </span>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
        </span>
        <span className={NUMERO}>{brlCheio(saldo.totalCent)}</span>
        <span className="text-xs text-muted">
          {saldo.semContas ? "Nenhuma conta financeira cadastrada" : folego}
        </span>
      </button>

      {aberto && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-80 rounded-2xl border border-line bg-surface p-4 shadow-lg">
          <p className="text-[11px] uppercase tracking-wide text-muted">Compõem o disponível</p>
          <ul className="mt-2 space-y-1.5">
            {saldo.contas.map((c) => (
              <LinhaConta key={c.id} conta={c} />
            ))}
            {!saldo.contas.length && (
              <li className="text-sm text-muted">Nenhuma conta marcada como disponível.</li>
            )}
          </ul>
          {saldo.foraDoDisponivel.length > 0 && (
            <>
              <div className="my-3 h-px bg-line" />
              <p className="text-[11px] uppercase tracking-wide text-muted">Fora do disponível</p>
              <ul className="mt-2 space-y-1.5">
                {saldo.foraDoDisponivel.map((c) => (
                  <li key={c.id} className="flex justify-between text-sm text-muted">
                    <span>{c.nome}</span>
                    <span>{brlCheio(c.saldoCent)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href="/gerencial/financeiro/configuracoes"
            className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
          >
            Ver contas no Caixa
          </Link>
        </div>
      )}
    </div>
  );
}

function LinhaConta({ conta }: { conta: ContaNoPopover }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm text-ink">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{conta.nome}</span>
        {conta.liquidezD1 && <span className="shrink-0 text-[11px] text-muted">liquidez D+1</span>}
        {conta.diasSemExtrato != null && conta.diasSemExtrato > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
            extrato há {conta.diasSemExtrato} dias
          </span>
        )}
      </span>
      <span className="shrink-0 font-semibold">{brlCheio(conta.saldoCent)}</span>
    </li>
  );
}

/* ── Caixa em 30 dias ──────────────────────────────────────────────────── */

function CardCaixa30({ dados }: { dados: DashboardFinanceiro }) {
  const { caixa30 } = dados;
  return (
    <Casca titulo="Caixa em 30 dias" dica={DICIONARIO.caixa30} href="/gerencial/financeiro/caixa">
      <span className={NUMERO}>{brlCheio(caixa30.saldoCent)}</span>
      <span className="text-xs text-muted">
        {caixa30.menorCent == null ? (
          "Sem lançamentos previstos no período"
        ) : (
          <>
            Menor saldo:{" "}
            <span className={cn("font-medium", caixa30.abaixoDaReserva ? "text-rose-600" : "text-ink")}>
              {brlCheio(caixa30.menorCent)} em {caixa30.menorEm}
            </span>
          </>
        )}
      </span>
    </Casca>
  );
}

/* ── Resultado do mês (§6.3) ───────────────────────────────────────────── */

function CardResultado({ dados }: { dados: DashboardFinanceiro }) {
  const { resultado } = dados;
  const negativo = resultado.liquidoCent < 0;
  const realizado = Math.max(0, Math.min(100, resultado.pctRealizado));

  return (
    <Casca
      titulo={`Resultado de ${resultado.mesLabel}`}
      dica={DICIONARIO.resultado}
      href="/gerencial/financeiro/resultados"
    >
      {/* Prejuízo fica em vermelho e NÃO vira exceção: é análise, não tarefa (§17). */}
      <span className={cn(NUMERO, negativo && "text-rose-600")}>{brlCheio(resultado.liquidoCent)}</span>
      <span className="flex w-full flex-col gap-2">
        <span className="flex h-1.5 overflow-hidden rounded-full bg-subtle-strong">
          <span className="bg-brand-500" style={{ width: `${realizado}%` }} />
          <span
            className="bg-[repeating-linear-gradient(135deg,var(--color-brand-300)_0_3px,transparent_3px_6px)]"
            style={{ width: `${100 - realizado}%` }}
          />
        </span>
        <span className="text-xs text-muted">
          {resultado.volumeCent === 0
            ? "Nada lançado neste mês ainda"
            : resultado.margemPct == null
              ? `Sem receita no mês, ${realizado}% das saídas já pagas`
              : `Margem de ${resultado.margemPct.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}%, sendo ${realizado}% já realizado`}
        </span>
      </span>
    </Casca>
  );
}

/* ── MRR e pontual (§6.2) ──────────────────────────────────────────────── */

function CardReceita({ dados }: { dados: DashboardFinanceiro }) {
  const { receita } = dados;
  const pctRec = Math.max(0, Math.min(100, receita.pctRecorrente));

  return (
    <Casca
      titulo={`MRR e pontual de ${dados.resultado.mesLabel}`}
      dica={DICIONARIO.receita}
      href="/gerencial/financeiro/resultados?aba=receita"
    >
      <span className="flex w-full items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[24px] font-semibold leading-none tracking-tight text-ink">
            {brlCheio(receita.mrrCent)}
          </span>
          <span className={cn("text-[11px] font-semibold", TEXTO_RECORRENTE)}>Recorrente</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={cn("text-[17px] font-semibold leading-none tracking-tight", TEXTO_PONTUAL)}>
            {brlCheio(receita.pontualCent)}
          </span>
          <span className={cn("text-[11px] font-semibold", TEXTO_PONTUAL)}>Pontual</span>
        </span>
      </span>
      <span className="flex w-full flex-col gap-2">
        <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-subtle-strong">
          {receita.totalCent > 0 && (
            <>
              <span className={COR_RECORRENTE} style={{ width: `${pctRec}%` }} />
              <span className={COR_PONTUAL} style={{ width: `${100 - pctRec}%` }} />
            </>
          )}
        </span>
        <span className="text-xs text-muted">
          {receita.totalCent > 0
            ? `Total de ${brlCheio(receita.totalCent)} faturados`
            : "Nada faturado neste mês ainda"}
          {receita.deltaMrr30Cent != null && receita.deltaMrr30Cent !== 0 && (
            <>
              . MRR{" "}
              <span
                className={cn(
                  "font-medium",
                  receita.deltaMrr30Cent > 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {brlComSinal(receita.deltaMrr30Cent)}
              </span>{" "}
              em 30 dias
            </>
          )}
        </span>
      </span>
    </Casca>
  );
}
