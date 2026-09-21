"use client";

import { useState } from "react";
import { TriangleAlert, Users, UserMinus, TrendingUp, Wallet, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brlCent, brlCurto } from "@/lib/data/planejamento";
import {
  impactoDePerderCliente, maximoDistribuivel, novosPorMesParaMeta, type Simulacao,
} from "@/lib/data/simulacao";
import type {
  CenarioCalculado, EstadoDaEmpresa, EventoPrevisto, PlanejamentoFuturoView,
} from "@/lib/data/planejamento-futuro-server";

/**
 * Abas Projeção (spec §8) e Cenários (§9).
 *
 * As duas leem a MESMA simulação: a projeção é o cenário Base. Fosse cada uma
 * com a sua conta, "se continuar assim" discordaria de "onde o ano termina" —
 * e as duas estariam na mesma tela, uma ao lado da outra.
 *
 * As perguntas rápidas recalculam no cliente porque são exploração: mexer no
 * campo e esperar o servidor mataria a conversa que elas existem para ter.
 */

const COR: Record<string, { texto: string; fundo: string; barra: string }> = {
  rose: { texto: "text-rose-600", fundo: "border-rose-500/40", barra: "bg-rose-500" },
  brand: { texto: "text-brand-600", fundo: "border-brand-500/40", barra: "bg-brand-500" },
  emerald: { texto: "text-emerald-600", fundo: "border-emerald-500/40", barra: "bg-emerald-500" },
};

/* ── Aba Projeção (§8) ─────────────────────────────────────────────────── */

export function AbaProjecao({ d }: { d: PlanejamentoFuturoView }) {
  if (d.pendente) {
    return <Aviso texto="A Projeção usa as tabelas de 0146_planejamento.sql. Rode a migração e recarregue." />;
  }
  if (!d.projecao) {
    return <Aviso texto="Sem dados suficientes para projetar o ano." />;
  }
  const sim = d.projecao;
  const semCustos = d.estado.folhaCent === 0 && d.estado.fixosCent === 0;

  return (
    <div className="space-y-4">
      <Lacunas lista={d.lacunas} />

      {/* Pouso do ano (§8.2) */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Receita em 12 meses" valor={brlCurto(sim.receitaAnoCent)} />
        <Numero
          rotulo="Resultado em 12 meses"
          valor={semCustos ? "—" : brlCurto(sim.resultadoAnoCent)}
          tom={!semCustos && sim.resultadoAnoCent < 0 ? "ruim" : undefined}
        />
        <Numero rotulo="MRR no fim do período" valor={brlCent(sim.mrrFinalCent)} />
        <Numero
          rotulo="Menor saldo de caixa"
          valor={semCustos ? "—" : `${brlCurto(sim.menorCaixaCent)} no mês ${sim.menorCaixaMes}`}
          tom={!semCustos && sim.abaixoDaReserva ? "ruim" : undefined}
        />
      </section>

      <GraficoResultado sim={sim} />

      <TabelaDoAno sim={sim} />

      <Eventos eventos={d.eventos} />
    </div>
  );
}

/** Barras de resultado mês a mês (§8.3). */
function GraficoResultado({ sim }: { sim: Simulacao }) {
  const maior = Math.max(1, ...sim.meses.map((m) => Math.abs(m.resultadoCent)));
  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-sm font-semibold text-ink">Resultado mês a mês</h3>
      <div className="flex h-40 items-end gap-2">
        {sim.meses.map((m) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-32 w-full items-end">
              <div
                title={`Mês ${m.mes}: ${brlCent(m.resultadoCent)}`}
                className={cn(
                  "w-full rounded-t",
                  m.resultadoCent < 0 ? "bg-rose-500" : "bg-brand-500",
                )}
                style={{ height: `${Math.max(2, (Math.abs(m.resultadoCent) / maior) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted">{m.mes}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Tabela do ano, em R$ mil (§8.4). */
function TabelaDoAno({ sim }: { sim: Simulacao }) {
  const linhas: { label: string; valor: (m: Simulacao["meses"][number]) => number; forte?: boolean }[] = [
    { label: "Receita recorrente", valor: (m) => m.receitaRecorrenteCent },
    { label: "Receita pontual", valor: (m) => m.receitaPontualCent },
    { label: "Custos e despesas", valor: (m) => -(m.receitaBrutaCent - m.resultadoCent) },
    { label: "Resultado", valor: (m) => m.resultadoCent, forte: true },
  ];
  const mil = (c: number) => (c === 0 ? "—" : (c / 100000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

  return (
    <Card className="overflow-x-auto p-0">
      <div className="p-5 pb-3">
        <h3 className="text-sm font-semibold text-ink">Os próximos 12 meses, em R$ mil</h3>
        <p className="text-xs text-muted">Projetado pelo cenário base, a partir do estado de hoje.</p>
      </div>
      <table className="w-full min-w-[820px] text-xs tabular-nums">
        <thead>
          <tr className="border-y border-line bg-subtle text-muted">
            <th className="px-4 py-2 text-left font-normal">Linha</th>
            {sim.meses.map((m) => (
              <th key={m.mes} className="px-2 py-2 text-right font-normal">{m.mes}</th>
            ))}
            <th className="px-3 py-2 text-right font-normal text-ink">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const total = sim.meses.reduce((s, m) => s + l.valor(m), 0);
            return (
              <tr key={l.label} className={cn("border-b border-line", l.forte && "bg-subtle")}>
                <td className={cn("px-4 py-2 text-ink", l.forte && "font-semibold")}>{l.label}</td>
                {sim.meses.map((m) => (
                  <td key={m.mes} className={cn("px-2 py-2 text-right text-muted", l.forte && "font-semibold text-ink")}>
                    {mil(l.valor(m))}
                  </td>
                ))}
                <td className={cn("px-3 py-2 text-right font-semibold text-ink")}>{mil(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** Eventos previstos (§8.5) — a única parte editável da projeção. */
function Eventos({ eventos }: { eventos: EventoPrevisto[] }) {
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Eventos previstos</h3>
        <p className="text-xs text-muted">
          O que você sabe que vai acontecer e ainda não está no sistema. É a única parte editável
          da projeção.
        </p>
      </div>
      {eventos.length ? (
        <ul className="space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span className="min-w-0">
                <span className="block text-sm text-ink">{e.descricao}</span>
                <span className="block text-[11px] text-muted">
                  {e.tipo} · a partir de {e.mesInicio}
                  {e.resolvidoRef && " · já aconteceu"}
                </span>
              </span>
              <span className={cn("text-sm font-semibold", e.valorCent < 0 ? "text-rose-600" : "text-emerald-600")}>
                {e.valorCent < 0 ? "−" : "+"}{brlCent(Math.abs(e.valorCent))}
                {e.recorrente && "/mês"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
          Nenhum evento previsto. Quando souber de um cliente entrando, saindo ou de um gasto
          pontual, registre aqui para a projeção contar com ele.
        </p>
      )}
    </Card>
  );
}

/* ── Aba Cenários (§9) ─────────────────────────────────────────────────── */

export function AbaCenarios({ d }: { d: PlanejamentoFuturoView }) {
  const [pergunta, setPergunta] = useState<string | null>(null);
  // Sem folha nem fixos, a simulação só tem receita: o resultado sai igual à
  // receita e a margem, 100%. É correto pela conta e falso pelo negócio.
  const semCustos = d.estado.folhaCent === 0 && d.estado.fixosCent === 0;

  if (d.pendente) {
    return <Aviso texto="Os Cenários usam as tabelas de 0146_planejamento.sql. Rode a migração e recarregue." />;
  }

  return (
    <div className="space-y-5">
      <Lacunas lista={d.lacunas} />

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Perguntas rápidas</h3>
          <p className="text-xs text-muted">As contas do quadro branco, com os números reais.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PERGUNTAS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPergunta(p.key)}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600">
                <p.icone className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-ink">{p.titulo}</span>
              <span className="text-xs leading-relaxed text-muted">{p.subtitulo}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Cenários dos próximos 12 meses</h3>
          <p className="text-xs text-muted">
            Três leituras do mesmo motor, mudando só as alavancas.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {d.cenarios.map((c) => (
            <CartaoCenario
              key={c.id}
              c={c}
              reserva={d.estado.reservaCent}
              semCustos={semCustos}
            />
          ))}
        </div>
      </section>

      {pergunta && (
        <DrawerPergunta
          chave={pergunta}
          estado={d.estado}
          base={d.cenarios.find((c) => c.id === "base") ?? null}
          onFechar={() => setPergunta(null)}
        />
      )}
    </div>
  );
}

function CartaoCenario({
  c, reserva, semCustos,
}: {
  c: CenarioCalculado;
  reserva: number;
  semCustos: boolean;
}) {
  const cor = COR[c.cor] ?? COR.brand;
  const linhas = [
    { l: "Receita em 12 meses", v: brlCurto(c.sim.receitaAnoCent) },
    {
      l: "Resultado em 12 meses",
      // Sem lado de custo, resultado é igual à receita — e mostrar isso como
      // resultado seria a mentira mais cara da página.
      v: semCustos ? "—" : brlCurto(c.sim.resultadoAnoCent),
      ruim: !semCustos && c.sim.resultadoAnoCent < 0,
    },
    {
      l: "Margem operacional",
      v: semCustos || c.sim.margemPct == null ? "—" : `${c.sim.margemPct.toFixed(1)}%`,
    },
    { l: "MRR no fim", v: brlCent(c.sim.mrrFinalCent) },
    {
      l: "Menor saldo de caixa",
      v: semCustos ? "—" : `${brlCurto(c.sim.menorCaixaCent)} no mês ${c.sim.menorCaixaMes}`,
      ruim: !semCustos && c.sim.menorCaixaCent < reserva,
    },
  ];

  return (
    <Card className={cn("space-y-3 p-5", cor.fundo)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={cn("h-2.5 w-2.5 rounded-sm", cor.barra)} />
          {c.nome}
        </span>
        <span className="text-[11px] text-muted">{c.subtitulo}</span>
      </div>

      <dl className="space-y-1.5 border-t border-line pt-3">
        {linhas.map((l) => (
          <div key={l.l} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted">{l.l}</dt>
            <dd className={cn("font-semibold text-ink", l.ruim && "text-rose-600")}>{l.v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 text-xs">
          <dt className="text-muted">Diferença para a base</dt>
          <dd className={cn("font-semibold", c.difParaBaseCent >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {semCustos ? "—" : `${c.difParaBaseCent >= 0 ? "+" : "−"}${brlCurto(Math.abs(c.difParaBaseCent))}`}
          </dd>
        </div>
      </dl>

      {semCustos && (
        <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] leading-relaxed text-muted">
          Sem folha e sem custos fixos cadastrados, só a receita é simulável. Resultado, margem e
          caixa voltam quando o lado do custo existir.
        </p>
      )}

      <p className={cn("text-[11px] leading-relaxed", c.capacidadeAlerta ? "text-amber-600" : "text-muted")}>
        {c.capacidadeTexto}
      </p>
    </Card>
  );
}

/* ── Perguntas rápidas (§9.1) ──────────────────────────────────────────── */

const PERGUNTAS = [
  { key: "contratar", titulo: "Posso contratar alguém?", subtitulo: "Custo, efeito no caixa e quantos clientes pagam a pessoa.", icone: Users },
  { key: "perder", titulo: "E se perdermos um cliente?", subtitulo: "O que sai da receita, da margem e o que vira ociosidade.", icone: UserMinus },
  { key: "vender", titulo: "Quanto preciso vender?", subtitulo: "Da meta para clientes novos por mês e capacidade.", icone: TrendingUp },
  { key: "distribuir", titulo: "Posso distribuir lucros?", subtitulo: "O menor saldo depois e o máximo que mantém a reserva.", icone: Wallet },
];

function DrawerPergunta({
  chave, estado, base, onFechar,
}: {
  chave: string;
  estado: EstadoDaEmpresa;
  base: CenarioCalculado | null;
  onFechar: () => void;
}) {
  const p = PERGUNTAS.find((x) => x.key === chave);
  const r = responder(chave, estado, base);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/50" />
      <aside
        aria-label={p?.titulo ?? "Pergunta"}
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface"
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-semibold text-ink">{p?.titulo}</h2>
          <button
            type="button" aria-label="Fechar" onClick={onFechar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div
            className={cn(
              "rounded-xl border p-4",
              r.tom === "bom" ? "border-emerald-500/40 bg-emerald-500/10"
                : r.tom === "ruim" ? "border-rose-500/40 bg-rose-500/10"
                  : "border-amber-500/40 bg-amber-500/10",
            )}
          >
            <p className="text-[11px] text-muted">Resposta</p>
            <p className={cn(
              "mt-0.5 text-base font-semibold leading-snug",
              r.tom === "bom" ? "text-emerald-600" : r.tom === "ruim" ? "text-rose-600" : "text-amber-600",
            )}>
              {r.resposta}
            </p>
          </div>

          <ul className="space-y-1.5">
            {r.linhas.map((l) => (
              <li key={l.l} className="flex justify-between gap-3 rounded-xl bg-subtle px-3 py-2.5 text-xs">
                <span className="text-muted">{l.l}</span>
                <span className="font-semibold text-ink">{l.v}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-muted">{r.nota}</p>
        </div>
      </aside>
    </div>
  );
}

type Resposta = {
  resposta: string;
  tom: "bom" | "ruim" | "atencao";
  linhas: { l: string; v: string }[];
  nota: string;
};

/**
 * As quatro contas do §9.1, sobre o mesmo motor.
 *
 * Nenhuma delas altera dado real: são perguntas, e a resposta é um número com
 * o porquê ao lado — que é o que o quadro branco nunca deixou registrado.
 */
function responder(chave: string, e: EstadoDaEmpresa, base: CenarioCalculado | null): Resposta {
  const semDados = e.mrrCent === 0;

  if (chave === "contratar") {
    const f = e.funcoes[0];
    if (!f) {
      return { resposta: "Nenhuma função cadastrada.", tom: "atencao", linhas: [],
        nota: "Cadastre as funções com capacidade e remuneração de referência em Configurações." };
    }
    const custo12 = f.remuneracaoCent * 12;
    const menorDepois = (base?.sim.menorCaixaCent ?? 0) - custo12;
    const ok = menorDepois >= e.reservaCent;
    // Quantos clientes novos pagam a pessoa: é a pergunta que transforma um
    // custo em meta comercial.
    const margemPorCliente = Math.round(e.ticketCent * (1 - e.impostosPct / 100) * 0.66);
    const pagam = margemPorCliente > 0 ? f.remuneracaoCent / margemPorCliente : 0;
    return {
      resposta: ok
        ? "O caixa aguenta a contratação."
        : "Com cuidado: o caixa fica abaixo da reserva.",
      tom: ok ? "bom" : "atencao",
      linhas: [
        { l: "Função", v: f.label },
        { l: "Custo nos próximos 12 meses", v: brlCent(custo12) },
        { l: "Efeito no resultado mensal", v: `−${brlCent(f.remuneracaoCent)}` },
        { l: "Menor saldo de caixa depois", v: brlCurto(menorDepois) },
        { l: "Vagas que a pessoa libera", v: `+${f.capacidadePorPessoa}` },
        { l: "Clientes novos que pagam a contratação", v: pagam > 0 ? pagam.toFixed(1) : "—" },
      ],
      nota: margemPorCliente > 0
        ? `Cada cliente novo deixa cerca de ${brlCent(margemPorCliente)} por mês depois de impostos e custo direto. É esse número que paga a contratação.`
        : "Sem ticket médio e alíquota, não dá para dizer quantos clientes pagam a pessoa.",
    };
  }

  if (chave === "perder") {
    if (semDados) return vazia("Sem clientes com fee cadastrado.");
    const r = impactoDePerderCliente({
      feeMensalCent: e.ticketCent,
      aliquotaPct: e.impostosPct,
      // Sem alocação de equipe, o custo que vira ociosidade ainda não é
      // conhecido — e a nota diz isso em vez de estimar.
      equipeAlocadaCent: 0,
      custosDiretosCent: 0,
    });
    const repor = e.novosPorMes > 0 && e.ticketCent > 0
      ? e.ticketCent / (e.novosPorMes * e.ticketCent)
      : null;
    return {
      resposta: `O resultado cai ${brlCent(r.quedaResultadoCent)} por mês, não só a margem de ${brlCent(r.margemPerdidaCent)}.`,
      tom: "ruim",
      linhas: [
        { l: "Receita perdida por mês", v: `−${brlCent(r.receitaPerdidaCent)}` },
        { l: "Margem de contribuição perdida", v: `−${brlCent(r.margemPerdidaCent)}` },
        { l: "Equipe que vira ociosidade", v: brlCent(r.ociosidadeCent) },
        { l: "Efeito no resultado em 12 meses", v: `−${brlCurto(r.quedaResultadoCent * 12)}` },
        { l: "Meses de vendas para repor", v: repor == null ? "—" : repor.toFixed(1) },
      ],
      nota: "A equipe que atendia o cliente continua sendo paga: por isso o resultado cai mais que a margem de contribuição. Com a alocação de equipe cadastrada, esta conta passa a mostrar quanto vira ociosidade.",
    };
  }

  if (chave === "vender") {
    if (semDados) return vazia("Sem MRR de partida para calcular a meta.");
    const meta = Math.round(e.mrrCent * 1.3);
    const novos = novosPorMesParaMeta(meta, e.mrrCent, e.ticketCent, e.churnPct, 12);
    return {
      resposta: e.ticketCent <= 0
        ? "Sem ticket médio não dá para converter a meta em clientes."
        : `${novos.toFixed(1)} clientes novos por mês.`,
      tom: novos > e.novosPorMes ? "atencao" : "bom",
      linhas: [
        { l: "Meta de MRR em 12 meses", v: brlCent(meta) },
        { l: "Ritmo atual", v: `${e.novosPorMes.toFixed(1)} por mês` },
        { l: "Ritmo necessário", v: `${novos.toFixed(1)} por mês` },
        { l: "Receita nova por mês", v: brlCent(Math.round(novos * e.ticketCent)) },
      ],
      nota: `A conta considera o churn de ${e.churnPct.toFixed(1)}% ao mês: parte do que entra só repõe o que sai.`,
    };
  }

  // distribuir
  const menor = base?.sim.menorCaixaCent ?? 0;
  const max = maximoDistribuivel(menor, e.reservaCent);
  return {
    resposta: max > 0
      ? `Dá para distribuir até ${brlCurto(max)} mantendo a reserva.`
      : "Não há folga sobre a reserva mínima.",
    tom: max > 0 ? "bom" : "ruim",
    linhas: [
      { l: "Menor saldo projetado", v: brlCurto(menor) },
      { l: "Reserva mínima", v: brlCent(e.reservaCent) },
      { l: "Máximo que mantém a reserva", v: brlCurto(max) },
    ],
    nota: e.reservaCent === 0
      ? "A reserva mínima está em R$ 0. Defina-a em Configurações para esta resposta considerar um piso de segurança."
      : "Considera a projeção base dos próximos 12 meses.",
  };
}

const vazia = (texto: string): Resposta => ({
  resposta: texto, tom: "atencao", linhas: [],
  nota: "A conta volta assim que os dados de origem existirem.",
});

/* ── Peças comuns ──────────────────────────────────────────────────────── */

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "ruim" }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <span className="text-xs text-muted">{rotulo}</span>
      <span className={cn("text-xl font-semibold tracking-tight text-ink", tom === "ruim" && "text-rose-600")}>
        {valor}
      </span>
    </div>
  );
}

/**
 * O que falta para a projeção ser completa.
 *
 * Fica visível de propósito: uma projeção com folha zerada parece ótima, e
 * quem não souber que a folha está faltando vai acreditar nela.
 */
function Lacunas({ lista }: { lista: string[] }) {
  if (!lista.length) return null;
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink">
        <TriangleAlert className="h-4 w-4 text-amber-600" />
        A projeção está incompleta
      </p>
      <ul className="mt-2 space-y-1">
        {lista.map((l) => (
          <li key={l} className="flex gap-2 text-xs text-muted">
            <span className="text-amber-600">•</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">{texto}</div>
  );
}
