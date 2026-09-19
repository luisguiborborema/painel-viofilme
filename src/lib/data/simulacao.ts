/**
 * Motor de simulação mensal do Planejamento (spec §10).
 *
 * A spec é explícita: **uma única biblioteca**, usada pelo assistente de
 * orçamento, pela projeção, pelos cenários e pelas perguntas rápidas. Quatro
 * telas que respondem à mesma pergunta com contas diferentes é o jeito seguro
 * de a agência decidir errado — e de ninguém descobrir qual das quatro estava
 * certa.
 *
 * **Dinheiro em centavos inteiros** (§24 do documento-mãe).
 *
 * A decisão estrutural: capacidade é parte do modelo, não um enfeite. Crescer
 * receita exige vaga de equipe, e o motor registra o mês em que o plano deixa
 * de caber na equipe — mesmo quando ninguém pediu para contratar. Sem isso, o
 * cenário "agressivo" mostra receita que a agência não consegue entregar.
 *
 * Client-safe: puro, sem I/O.
 */

/* ── Entradas ──────────────────────────────────────────────────────────── */

/** Uma função de entrega: capacidade por pessoa e custo de referência. */
export type Funcao = {
  key: string;
  label: string;
  /** Quantos clientes uma pessoa dessa função atende (spec 15). */
  capacidadePorPessoa: number;
  /** Remuneração de referência, em centavos. */
  remuneracaoCent: number;
  /** Vagas que um cliente médio consome nesta função. */
  vagasPorCliente: number;
};

export type EstadoInicial = {
  /** MRR de partida, em centavos. */
  mrrCent: number;
  clientes: number;
  /** Vagas em uso e capacidade instalada, por função. */
  vagasUsadas: Record<string, number>;
  capacidade: Record<string, number>;
  /** Folha mensal total, em centavos. */
  folhaCent: number;
  /** Custos fixos mensais, em centavos. */
  fixosCent: number;
  /** Saldo de caixa de partida, em centavos. */
  caixaCent: number;
};

export type Contratacao = {
  funcao: string;
  /** Mês (1..horizonte) em que entra. */
  mes: number;
  remuneracaoCent: number;
};

export type Alavancas = {
  /** Clientes novos por mês. Aceita fração (1,2 clientes/mês). */
  novosPorMes: number;
  /** Churn mensal em % (2.5 = 2,5%). */
  churnPct: number;
  /** Ticket dos novos, em centavos. */
  ticketCent: number;
  /** Receita pontual base por mês, em centavos. */
  pontualCent: number;
  /** Ajuste da pontual em % (−30 = 30% abaixo da média). */
  pontualAjustePct: number;
  /** Ajuste dos custos fixos em %. */
  fixosAjustePct: number;
  /** Reajuste de preço, em %, aplicado no mês indicado. */
  reajustePct?: number;
  reajusteMes?: number;
  /** Reajuste da folha, em %, aplicado no mês indicado. */
  folhaReajustePct?: number;
  folhaReajusteMes?: number;
  /** Alíquotas sobre receita, em %. */
  impostosPct: number;
  variaveisPct: number;
  comissaoPct: number;
  /** Contrata sozinho quando a capacidade estoura (só em cenários, spec 11). */
  contratarAutomatico?: boolean;
  contratacoes?: Contratacao[];
  /** Saídas de caixa que não passam pelo resultado. */
  investimentosCent?: { mes: number; valorCent: number }[];
  distribuicoesCent?: { mes: number; valorCent: number }[];
  /** Aplicação mensal na reserva, em centavos. */
  aplicacaoMensalCent?: number;
};

export type OpcoesSimulacao = {
  meses?: number;
  /**
   * Quanto do resultado vira caixa (spec 15: padrão 0,95).
   *
   * Resultado é competência e caixa é caixa: parte do que a DRE reconhece num
   * mês entra no seguinte, e parte não entra nunca. Sem o fator, a projeção de
   * caixa fica otimista todo mês, pelo mesmo motivo, e ninguém percebe.
   */
  fatorCaixa?: number;
  /** Reserva mínima, em centavos — o piso que o caixa não deve furar. */
  reservaCent?: number;
};

/* ── Saída ─────────────────────────────────────────────────────────────── */

export type MesSimulado = {
  mes: number;
  mrrCent: number;
  clientes: number;
  receitaRecorrenteCent: number;
  receitaPontualCent: number;
  receitaBrutaCent: number;
  impostosCent: number;
  variaveisCent: number;
  equipeCent: number;
  fixosCent: number;
  resultadoCent: number;
  caixaCent: number;
  /** Função cuja capacidade estourou neste mês, se alguma. */
  estouro: { funcao: string; necessario: number; capacidade: number } | null;
  contratou: string[];
};

export type Simulacao = {
  meses: MesSimulado[];
  receitaAnoCent: number;
  receitaLiquidaAnoCent: number;
  resultadoAnoCent: number;
  /** Margem operacional em %, ou null sem receita. */
  margemPct: number | null;
  mrrFinalCent: number;
  menorCaixaCent: number;
  menorCaixaMes: number;
  /** Primeiro mês em que a capacidade estourou sem contratação. */
  primeiroEstouro: { funcao: string; mes: number } | null;
  contratacoesFeitas: { funcao: string; mes: number }[];
  /** O menor saldo furou a reserva mínima? */
  abaixoDaReserva: boolean;
};

const cent = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};
const pct = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/**
 * Roda a simulação mês a mês.
 *
 * A ordem dentro do mês importa e segue a spec: primeiro o churn e as entradas
 * mexem no MRR e nas vagas, depois a capacidade é conferida (e a contratação
 * acontece, se automática), e só então o resultado do mês é calculado — assim
 * a contratação já pesa no mês em que foi preciso, não no seguinte.
 */
export function simular(
  inicial: EstadoInicial,
  alav: Alavancas,
  funcoes: Funcao[],
  opts: OpcoesSimulacao = {},
): Simulacao {
  const horizonte = Math.max(1, Math.min(60, Math.round(opts.meses ?? 12)));
  const fatorCaixa = Number.isFinite(opts.fatorCaixa) ? (opts.fatorCaixa as number) : 0.95;
  const reserva = cent(opts.reservaCent ?? 0);

  let mrr = cent(inicial.mrrCent);
  let clientes = Number(inicial.clientes) || 0;
  let caixa = cent(inicial.caixaCent);
  let folha = cent(inicial.folhaCent);

  const vagas: Record<string, number> = { ...inicial.vagasUsadas };
  const cap: Record<string, number> = { ...inicial.capacidade };
  const extraEquipe: number[] = new Array(horizonte + 1).fill(0);

  // Contratações planejadas entram como custo a partir do mês definido.
  for (const c of alav.contratacoes ?? []) {
    const m = Math.round(c.mes);
    if (m >= 1 && m <= horizonte) {
      for (let k = m; k <= horizonte; k++) extraEquipe[k] += cent(c.remuneracaoCent);
      const f = funcoes.find((x) => x.key === c.funcao);
      if (f) cap[c.funcao] = (cap[c.funcao] ?? 0) + f.capacidadePorPessoa;
    }
  }

  const meses: MesSimulado[] = [];
  let primeiroEstouro: { funcao: string; mes: number } | null = null;
  const contratacoesFeitas: { funcao: string; mes: number }[] = [];
  let menorCaixa = Infinity;
  let menorCaixaMes = 1;
  let receitaAno = 0;
  let receitaLiquidaAno = 0;
  let resultadoAno = 0;

  for (let m = 1; m <= horizonte; m++) {
    // 1) Movimento da carteira.
    const saindo = clientes * (pct(alav.churnPct) / 100);
    clientes = Math.max(0, clientes - saindo + pct(alav.novosPorMes));
    mrr = Math.round(mrr * (1 - pct(alav.churnPct) / 100) + pct(alav.novosPorMes) * cent(alav.ticketCent));
    if (alav.reajusteMes === m && alav.reajustePct) {
      mrr = Math.round(mrr * (1 + pct(alav.reajustePct) / 100));
    }

    // 2) Vagas e capacidade, antes do custo: a contratação pesa no mês em que
    //    foi necessária.
    let estouro: MesSimulado["estouro"] = null;
    const contratou: string[] = [];
    for (const f of funcoes) {
      const usada = (vagas[f.key] ?? 0) - f.vagasPorCliente * saindo + f.vagasPorCliente * pct(alav.novosPorMes);
      vagas[f.key] = usada;
      const capacidade = cap[f.key] ?? 0;
      if (usada > capacidade + 1e-9) {
        if (alav.contratarAutomatico) {
          cap[f.key] = capacidade + f.capacidadePorPessoa;
          for (let k = m; k <= horizonte; k++) extraEquipe[k] += f.remuneracaoCent;
          contratou.push(f.key);
          contratacoesFeitas.push({ funcao: f.key, mes: m });
        } else if (!estouro) {
          estouro = { funcao: f.key, necessario: usada, capacidade };
          if (!primeiroEstouro) primeiroEstouro = { funcao: f.key, mes: m };
        }
      }
    }

    // 3) Resultado do mês.
    if (alav.folhaReajusteMes === m && alav.folhaReajustePct) {
      folha = Math.round(folha * (1 + pct(alav.folhaReajustePct) / 100));
    }
    const pontual = Math.round(cent(alav.pontualCent) * (1 + pct(alav.pontualAjustePct) / 100));
    const receitaBruta = mrr + pontual;
    const impostos = Math.round(receitaBruta * (pct(alav.impostosPct) / 100));
    const comissao = Math.round(pct(alav.novosPorMes) * cent(alav.ticketCent) * (pct(alav.comissaoPct) / 100));
    const variaveis = Math.round(receitaBruta * (pct(alav.variaveisPct) / 100)) + comissao;
    const equipe = folha + extraEquipe[m];
    const fixos = Math.round(cent(inicial.fixosCent) * (1 + pct(alav.fixosAjustePct) / 100));
    const resultado = receitaBruta - impostos - variaveis - equipe - fixos;

    // 4) Caixa: o resultado só vira dinheiro em parte, e as saídas de capital
    //    não passam pela DRE (§10 do documento-mãe).
    const inv = (alav.investimentosCent ?? []).filter((x) => x.mes === m).reduce((a, x) => a + cent(x.valorCent), 0);
    const dist = (alav.distribuicoesCent ?? []).filter((x) => x.mes === m).reduce((a, x) => a + cent(x.valorCent), 0);
    caixa = Math.round(caixa + resultado * fatorCaixa - inv - dist - cent(alav.aplicacaoMensalCent ?? 0));

    if (caixa < menorCaixa) { menorCaixa = caixa; menorCaixaMes = m; }
    receitaAno += receitaBruta;
    receitaLiquidaAno += receitaBruta - impostos;
    resultadoAno += resultado;

    meses.push({
      mes: m, mrrCent: mrr, clientes, receitaRecorrenteCent: mrr, receitaPontualCent: pontual,
      receitaBrutaCent: receitaBruta, impostosCent: impostos, variaveisCent: variaveis,
      equipeCent: equipe, fixosCent: fixos, resultadoCent: resultado, caixaCent: caixa,
      estouro, contratou,
    });
  }

  return {
    meses,
    receitaAnoCent: receitaAno,
    receitaLiquidaAnoCent: receitaLiquidaAno,
    resultadoAnoCent: resultadoAno,
    margemPct: receitaLiquidaAno > 0 ? Math.round((resultadoAno / receitaLiquidaAno) * 1000) / 10 : null,
    mrrFinalCent: mrr,
    menorCaixaCent: menorCaixa === Infinity ? cent(inicial.caixaCent) : menorCaixa,
    menorCaixaMes,
    primeiroEstouro,
    contratacoesFeitas,
    abaixoDaReserva: (menorCaixa === Infinity ? cent(inicial.caixaCent) : menorCaixa) < reserva,
  };
}

/* ── Perguntas rápidas (spec 9.1) ──────────────────────────────────────── */

/**
 * Quantos clientes novos por mês para chegar a um MRR alvo.
 *
 * A fórmula da spec: novos = (meta − MRR × (1−churn)^n) ÷ (ticket × Σ(1−churn)^(n−1−i)).
 * O somatório existe porque um cliente que entra em janeiro sofre churn onze
 * vezes até dezembro — tratar como se todos entrassem hoje subestima a meta.
 */
export function novosPorMesParaMeta(
  metaCent: number,
  mrrAtualCent: number,
  ticketCent: number,
  churnPct: number,
  meses = 12,
): number {
  const t = cent(ticketCent);
  if (t <= 0 || meses <= 0) return 0;
  const sobra = 1 - pct(churnPct) / 100;
  const restante = cent(metaCent) - cent(mrrAtualCent) * Math.pow(sobra, meses);
  let soma = 0;
  for (let i = 0; i < meses; i++) soma += Math.pow(sobra, meses - 1 - i);
  if (soma <= 0) return 0;
  return Math.max(0, Math.round((restante / (t * soma)) * 10) / 10);
}

/**
 * O quanto o resultado cai ao perder um cliente.
 *
 * A resposta que a spec quer em destaque: o resultado cai quase pelo fee
 * líquido inteiro, não pela margem de contribuição. A equipe que atendia o
 * cliente continua sendo paga até as vagas serem reocupadas — e é justamente
 * essa diferença que faz a perda doer mais do que a planilha sugere.
 */
export function impactoDePerderCliente(input: {
  feeMensalCent: number;
  custosDiretosCent: number;
  equipeAlocadaCent: number;
  aliquotaPct: number;
}): { receitaPerdidaCent: number; margemPerdidaCent: number; quedaResultadoCent: number; ociosidadeCent: number } {
  const fee = cent(input.feeMensalCent);
  const liquido = Math.round(fee * (1 - pct(input.aliquotaPct) / 100));
  const equipe = cent(input.equipeAlocadaCent);
  const diretos = cent(input.custosDiretosCent);
  return {
    receitaPerdidaCent: fee,
    margemPerdidaCent: liquido - diretos - equipe,
    // A equipe não sai junto com o cliente: vira ociosidade.
    quedaResultadoCent: liquido - diretos,
    ociosidadeCent: equipe,
  };
}

/** Máximo que se pode distribuir mantendo a reserva (spec 9.1, pergunta 4). */
export function maximoDistribuivel(menorSaldoCent: number, reservaCent: number): number {
  return Math.max(0, cent(menorSaldoCent) - cent(reservaCent));
}
