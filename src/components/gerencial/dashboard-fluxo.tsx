"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brlCheio, ddmm, type ColunaDia } from "@/lib/data/dashboard-financeiro";
import type {
  DashboardFinanceiro, PainelPagamentos, PainelRecebimentos,
} from "@/lib/data/dashboard-financeiro-server";

/**
 * Bloco 3 — Entradas e saídas (spec §7). Dois painéis com a MESMA estrutura,
 * porque a pergunta é a mesma nos dois lados: quanto do mês já resolveu, o que
 * veio na última semana, o que vem na próxima e o que ficou para trás.
 *
 * O grid usa `items-start`: sem isso, abrir a composição de um painel estica o
 * outro e cria um vazio do tamanho da diferença.
 */
export function DashboardFluxo({ dados }: { dados: DashboardFinanceiro }) {
  return (
    <section
      aria-labelledby="sec-entradas-saidas"
      data-tour="fin-dash-fluxo"
      className="space-y-4"
    >
      <div>
        <h2 id="sec-entradas-saidas" className="text-lg font-semibold tracking-tight text-ink">
          Entradas e saídas
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          O ritmo do dinheiro: o que aconteceu na última semana, o que vem na próxima e o que
          ficou para trás.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PainelRecebimentosCard painel={dados.recebimentos} />
        <PainelPagamentosCard painel={dados.pagamentos} />
      </div>
    </section>
  );
}

/* ── Peças comuns aos dois painéis ─────────────────────────────────────── */

function Cabecalho({ titulo, href, label }: { titulo: string; href: string; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-base font-semibold text-ink">{titulo}</h3>
      <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">
        {label}
      </Link>
    </div>
  );
}

function Progresso({
  painel,
  verbo,
  corBaixado,
}: {
  painel: PainelRecebimentos | PainelPagamentos;
  verbo: string;
  corBaixado: string;
}) {
  const p = painel.progresso;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {p.totalCent > 0 ? `${p.pct}%` : "—"}
        </span>
        <span className="text-sm text-muted">
          {p.totalCent > 0
            ? `do que vence no mês já ${verbo}: ${brlCheio(p.baixadoCent)} de ${brlCheio(p.totalCent)}`
            : "nada vence neste mês"}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle-strong">
        <span className={corBaixado} style={{ width: `${p.larguraBaixada}%` }} />
        <span className="bg-rose-500" style={{ width: `${p.larguraVencida}%` }} />
      </div>
    </div>
  );
}

function Numeros({ painel }: { painel: PainelRecebimentos | PainelPagamentos }) {
  const caixa = "flex flex-col gap-1 rounded-xl px-3 py-2.5";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={cn(caixa, "bg-subtle")}>
        <span className="text-[11px] text-muted">Últimos 7 dias</span>
        <span className="text-base font-semibold text-ink">{brlCheio(painel.ultimos7.valorCent)}</span>
        <span className="text-[11px] text-muted">{painel.ultimos7.qtd} baixas</span>
      </div>
      <div className={cn(caixa, "bg-subtle")}>
        <span className="text-[11px] text-muted">Próximos 7 dias</span>
        <span className="text-base font-semibold text-ink">{brlCheio(painel.proximos7.valorCent)}</span>
        <span className="text-[11px] text-muted">{painel.proximos7.qtd} lançamentos</span>
      </div>
      <div className={cn(caixa, painel.vencido.valorCent > 0 ? "bg-rose-500/10" : "bg-subtle")}>
        <span className="text-[11px] text-muted">Vencido</span>
        <span
          className={cn(
            "text-base font-semibold",
            painel.vencido.valorCent > 0 ? "text-rose-600" : "text-ink",
          )}
        >
          {brlCheio(painel.vencido.valorCent)}
        </span>
        <span className="text-[11px] text-muted">{painel.vencido.detalhe || "nada em atraso"}</span>
      </div>
    </div>
  );
}

/**
 * A barra dia a dia: 7 dias atrás, hoje e 7 à frente. Passado é preenchido
 * (aconteceu); hoje e futuro são só contorno (ainda é previsão) — a diferença
 * entre fato e promessa precisa ser visível sem ler a legenda.
 */
function BarraDiaADia({
  colunas,
  de,
  ate,
  cor,
  borda,
}: {
  colunas: ColunaDia[];
  de: string;
  ate: string;
  cor: string;
  borda: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] text-muted">
        Dia a dia, de {de} a {ate}
      </span>
      <div className="flex h-16 items-end gap-1">
        {colunas.map((c) => (
          <div
            key={c.dataIso}
            title={`${ddmm(c.dataIso)}: ${brlCheio(c.valorCent)}`}
            className={cn(
              // A faixa de hoje é só um fundo. Com contraste alto ela vira uma
              // barra cheia e passa a mentir sobre o dia mais movimentado.
              "flex h-full flex-1 items-end rounded",
              c.hoje && "bg-subtle",
            )}
          >
            <div
              className={cn(
                "w-full rounded-sm",
                c.valorCent === 0 ? "bg-line" : c.previsto ? cn("border", borda) : cor,
              )}
              style={{ height: c.valorCent === 0 ? 2 : `${Math.max(8, c.alturaPct)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{de}</span>
        <span className="font-semibold text-ink">hoje</span>
        <span>{ate}</span>
      </div>
    </div>
  );
}

function BotaoComposicao({
  aberto,
  onClick,
  label,
}: {
  aberto: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      className="flex h-9 items-center justify-center gap-2 rounded-xl border border-line bg-subtle text-xs font-medium text-muted transition-colors hover:text-ink"
    >
      {aberto ? "Ocultar composição" : label}
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
    </button>
  );
}

function Rodape({ itens }: { itens: { label: string; valor: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {itens.map((i) => (
        <div key={i.label} className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted">{i.label}</span>
          <span className="text-sm font-semibold text-ink">{i.valor}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Recebimentos ──────────────────────────────────────────────────────── */

function PainelRecebimentosCard({ painel }: { painel: PainelRecebimentos }) {
  const [aberto, setAberto] = useState(false);
  const maiorAging = Math.max(0, ...painel.aging.map((f) => f.valorCent));

  return (
    <Card className="flex flex-col gap-5 p-5">
      <Cabecalho
        titulo="Recebimentos"
        href="/gerencial/financeiro?aba=receber"
        label="Abrir recebimentos"
      />
      <Progresso painel={painel} verbo="entrou" corBaixado="bg-emerald-500" />
      <Numeros painel={painel} />
      <BotaoComposicao
        aberto={aberto}
        onClick={() => setAberto((v) => !v)}
        label="Ver composição dos recebimentos"
      />

      {aberto && (
        <div className="space-y-5">
          <BarraDiaADia
            colunas={painel.barra}
            de={painel.barraDe}
            ate={painel.barraAte}
            cor="bg-emerald-500"
            borda="border-emerald-500"
          />
          <div className="grid gap-5 border-t border-line pt-4 sm:grid-cols-[1.15fr_1fr]">
            <div className="space-y-2.5">
              <span className="text-[11px] text-muted">Vencidos por tempo de atraso</span>
              <div className="grid grid-cols-5 items-end gap-1.5">
                {painel.aging.map((f) => (
                  <div key={f.key} className="flex flex-col items-stretch gap-1.5">
                    <span
                      className={cn(
                        "text-center text-[11px] font-semibold",
                        f.valorCent > 0 ? "text-ink" : "text-muted/60",
                      )}
                    >
                      {f.valorCent > 0 ? brlCheio(f.valorCent) : "—"}
                    </span>
                    <div className="flex h-11 items-end">
                      <div
                        className={cn("w-full rounded-sm", f.valorCent > 0 ? "bg-rose-500" : "bg-line")}
                        style={{
                          height:
                            maiorAging > 0 && f.valorCent > 0
                              ? `${Math.max(12, f.alturaPct)}%`
                              : 2,
                        }}
                      />
                    </div>
                    <span className="text-center text-[11px] text-muted">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted">Próximo recebimento</span>
                {painel.proximo ? (
                  <>
                    <span className="text-sm font-semibold text-ink">
                      {painel.proximo.pessoa}, {painel.proximo.quando}
                    </span>
                    <span className="text-xs text-emerald-600">
                      {brlCheio(painel.proximo.valorCent)}, {painel.proximo.nota}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Nada a receber nos próximos dias</span>
                )}
              </div>
              <Rodape
                itens={[
                  {
                    label: "Atraso médio",
                    valor:
                      painel.atrasoMedioDias == null
                        ? "—"
                        : `${painel.atrasoMedioDias.toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })} dias`,
                  },
                  {
                    label: "Inadimplência 90d",
                    valor:
                      painel.inadimplencia90Pct == null
                        ? "—"
                        : `${painel.inadimplencia90Pct.toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })}%`,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Pagamentos ────────────────────────────────────────────────────────── */

function PainelPagamentosCard({ painel }: { painel: PainelPagamentos }) {
  const [aberto, setAberto] = useState(false);
  const s = painel.situacao;
  const largura = (v: number) => (s.totalCent > 0 ? `${(v / s.totalCent) * 100}%` : "0%");

  const legenda = [
    { label: "Vencido", valor: s.vencidoCent, cor: "bg-rose-500" },
    ...(painel.aprovacaoLigada
      ? [{ label: "Aguardando aprovação", valor: s.aguardandoAprovacaoCent, cor: "bg-amber-500" }]
      : []),
    { label: "Programado", valor: s.programadoCent, cor: "bg-sky-500" },
    { label: "Sem programação", valor: s.semProgramacaoCent, cor: "bg-slate-400" },
  ];

  return (
    <Card className="flex flex-col gap-5 p-5">
      <Cabecalho titulo="Pagamentos" href="/gerencial/financeiro?aba=pagar" label="Abrir pagamentos" />
      <Progresso painel={painel} verbo="foi pago" corBaixado="bg-sky-500" />
      <Numeros painel={painel} />
      <BotaoComposicao
        aberto={aberto}
        onClick={() => setAberto((v) => !v)}
        label="Ver composição dos pagamentos"
      />

      {aberto && (
        <div className="space-y-5">
          <BarraDiaADia
            colunas={painel.barra}
            de={painel.barraDe}
            ate={painel.barraAte}
            cor="bg-sky-500"
            borda="border-sky-500"
          />
          <div className="grid gap-5 border-t border-line pt-4 sm:grid-cols-[1.15fr_1fr]">
            <div className="space-y-2.5">
              <span className="text-[11px] text-muted">
                Situação dos {brlCheio(s.totalCent)} que faltam pagar no mês
              </span>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-subtle-strong">
                {legenda.map((l) => (
                  <span key={l.label} className={l.cor} style={{ width: largura(l.valor) }} />
                ))}
              </div>
              <ul className="space-y-1.5 text-xs">
                {legenda.map((l) => (
                  <li key={l.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-muted">
                      <span className={cn("h-2 w-2 rounded-sm", l.cor)} />
                      {l.label}
                    </span>
                    <span className="font-medium text-ink">{brlCheio(l.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted">Próximo pagamento</span>
                {painel.proximo ? (
                  <>
                    <span className="text-sm font-semibold text-ink">
                      {painel.proximo.pessoa}, {painel.proximo.quando}
                    </span>
                    <span className="text-xs text-muted">
                      {brlCheio(painel.proximo.valorCent)}
                      {painel.proximo.nota && `, ${painel.proximo.nota}`}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Nada a pagar nos próximos dias</span>
                )}
              </div>
              <Rodape
                itens={[
                  {
                    label: "Pagos em dia 90d",
                    valor: painel.pagosEmDiaPct == null ? "—" : `${painel.pagosEmDiaPct}%`,
                  },
                  {
                    label: "Maior saída prevista",
                    valor: painel.maiorSaidaPrevista
                      ? `${painel.maiorSaidaPrevista.descricao}, ${ddmm(painel.maiorSaidaPrevista.dataIso)}`
                      : "—",
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
