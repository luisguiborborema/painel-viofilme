/**
 * Resultados — DRE gerencial, rentabilidade e receita.
 *
 * A base é o **tipo de impacto** da categoria (§10 do documento-mãe), não o
 * nome dela. Sete tipos fechados no sistema decidem sozinhos onde cada
 * categoria aparece: se é receita, dedução, custo direto, despesa, resultado
 * financeiro, investimento ou movimento com sócios.
 *
 * O financeiro atual tem só dois grupos (`deducao` e `custo`), e é por isso que
 * hoje não dá para montar a DRE do §11: investimento e distribuição de lucros
 * caem em "custo" e destroem a margem de um mês, quando deveriam ficar **fora**
 * da DRE. Uma câmera de R$ 18.900 não é prejuízo operacional.
 *
 * **Dinheiro em centavos inteiros** (§24 do documento-mãe).
 *
 * Client-safe: puro, sem I/O.
 */

/* ── Tipos de impacto (§10) ────────────────────────────────────────────── */

export type ImpactType =
  | "operating_revenue"
  | "revenue_deduction"
  | "direct_cost"
  | "operating_expense"
  | "financial_result"
  | "investment"
  | "equity_financing";

export const IMPACT_TYPES: {
  key: ImpactType;
  label: string;
  hint: string;
  /** Entra na DRE? Investimento e sócios ficam no bloco informativo. */
  naDre: boolean;
  /** Como soma no resultado: +1 soma, −1 subtrai, 0 fora. */
  sinal: 1 | -1 | 0;
}[] = [
  { key: "operating_revenue", label: "Receita operacional", hint: "Fee mensal, projeto, diária", naDre: true, sinal: 1 },
  { key: "revenue_deduction", label: "Dedução da receita", hint: "DAS/ISS sobre faturamento, desconto concedido", naDre: true, sinal: -1 },
  { key: "direct_cost", label: "Custo direto", hint: "Equipe de entrega, freelancer de cliente, locação para job", naDre: true, sinal: -1 },
  { key: "operating_expense", label: "Despesa operacional", hint: "Aluguel, softwares, administrativo, pró-labore", naDre: true, sinal: -1 },
  { key: "financial_result", label: "Resultado financeiro", hint: "Tarifa, taxa do gateway, juros, rendimento", naDre: true, sinal: 1 },
  { key: "investment", label: "Investimento", hint: "Câmera, lente, computador, reforma", naDre: false, sinal: 0 },
  { key: "equity_financing", label: "Sócios e financiamento", hint: "Aporte, distribuição de lucros, empréstimo (principal)", naDre: false, sinal: 0 },
];

export function impactoPorKey(k: string) {
  return IMPACT_TYPES.find((t) => t.key === k);
}

/* ── DRE (§11) ─────────────────────────────────────────────────────────── */

/** Totais em centavos, por tipo de impacto. */
export type TotaisPorImpacto = Partial<Record<ImpactType, number>>;

export type Dre = {
  receitaBrutaCent: number;
  deducoesCent: number;
  receitaLiquidaCent: number;
  custosDiretosCent: number;
  margemBrutaCent: number;
  despesasOperacionaisCent: number;
  resultadoOperacionalCent: number;
  resultadoFinanceiroCent: number;
  resultadoLiquidoCent: number;
  /** Informativo, fora da DRE. */
  investimentosCent: number;
  sociosCent: number;
  /** Margens em %, ou null sem receita líquida. */
  margemBrutaPct: number | null;
  margemOperacionalPct: number | null;
};

const cent = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

const pctDe = (parte: number, total: number): number | null =>
  total === 0 ? null : Math.round((parte / total) * 1000) / 10;

/**
 * Monta a DRE a partir dos totais por tipo de impacto.
 *
 * Os valores de custo chegam positivos (o quanto se gastou) e a estrutura
 * subtrai. Guardar custo como número negativo parece elegante e depois gera
 * a soma errada em algum lugar, porque metade do código esquece o sinal.
 */
export function montarDre(t: TotaisPorImpacto): Dre {
  const receitaBruta = cent(t.operating_revenue);
  const deducoes = cent(t.revenue_deduction);
  const receitaLiquida = receitaBruta - deducoes;
  const custosDiretos = cent(t.direct_cost);
  const margemBruta = receitaLiquida - custosDiretos;
  const despesas = cent(t.operating_expense);
  const resultadoOperacional = margemBruta - despesas;
  // Financeiro entra somando: pode ser positivo (rendimento) ou negativo
  // (tarifa), e quem grava decide o sinal.
  const financeiro = cent(t.financial_result);
  const resultadoLiquido = resultadoOperacional + financeiro;

  return {
    receitaBrutaCent: receitaBruta,
    deducoesCent: deducoes,
    receitaLiquidaCent: receitaLiquida,
    custosDiretosCent: custosDiretos,
    margemBrutaCent: margemBruta,
    despesasOperacionaisCent: despesas,
    resultadoOperacionalCent: resultadoOperacional,
    resultadoFinanceiroCent: financeiro,
    resultadoLiquidoCent: resultadoLiquido,
    investimentosCent: cent(t.investment),
    sociosCent: cent(t.equity_financing),
    margemBrutaPct: pctDe(margemBruta, receitaLiquida),
    margemOperacionalPct: pctDe(resultadoOperacional, receitaLiquida),
  };
}

/* ── "Para cada R$ 100 de receita" (§5.1) ──────────────────────────────── */

export type SegmentoCem = { key: string; label: string; valorCent: number; pctDaReceita: number };

/**
 * Divide R$ 100 de receita bruta entre os destinos.
 *
 * O financeiro só aparece quando é custo: rendimento não "consome" receita, e
 * mostrá-lo como fatia negativa quebraria a leitura da barra.
 */
export function paraCadaCem(t: TotaisPorImpacto): { segmentos: SegmentoCem[]; prejuizoCent: number | null } {
  const receita = cent(t.operating_revenue);
  if (receita <= 0) return { segmentos: [], prejuizoCent: null };

  const financeiroCusto = Math.max(0, -cent(t.financial_result));
  const brutos: { key: string; label: string; valorCent: number }[] = [
    { key: "impostos", label: "Impostos", valorCent: cent(t.revenue_deduction) },
    { key: "diretos", label: "Custos diretos", valorCent: cent(t.direct_cost) },
    { key: "estrutura", label: "Estrutura e despesas", valorCent: cent(t.operating_expense) },
    { key: "financeiro", label: "Financeiro", valorCent: financeiroCusto },
  ].filter((s) => s.valorCent > 0);

  const consumido = brutos.reduce((a, s) => a + s.valorCent, 0);
  const sobra = receita - consumido;

  const segmentos = brutos.map((s) => ({ ...s, pctDaReceita: Math.round((s.valorCent / receita) * 1000) / 10 }));
  if (sobra > 0) {
    segmentos.push({
      key: "resultado", label: "Resultado", valorCent: sobra,
      pctDaReceita: Math.round((sobra / receita) * 1000) / 10,
    });
  }
  // Prejuízo: a spec manda trocar o segmento por um aviso, não desenhar uma
  // fatia negativa que o olho lê como se fosse resultado.
  return { segmentos, prejuizoCent: sobra < 0 ? -sobra : null };
}

/* ── Variação explicada (§5.3) ─────────────────────────────────────────── */

export type ImpactoNaVariacao = { key: string; label: string; impactoCent: number };

/**
 * Decompõe a diferença de resultado entre dois períodos, por categoria.
 *
 * O impacto é (atual − comparação) × sinal: receita que subiu ajuda, custo que
 * subiu atrapalha. Sem o sinal, a lista ordena pelo tamanho da mudança e mostra
 * "crescimento de receita" ao lado de "estouro de custo" como se fossem a mesma
 * coisa — quando são opostas.
 */
export function explicarVariacao(
  atual: { key: string; label: string; valorCent: number; impacto: ImpactType }[],
  anterior: Record<string, number>,
  quantos = 5,
): { top: ImpactoNaVariacao[]; demaisCent: number; totalCent: number } {
  const todos = atual.map((c) => {
    const s = impactoPorKey(c.impacto)?.sinal ?? 0;
    return { key: c.key, label: c.label, impactoCent: (cent(c.valorCent) - cent(anterior[c.key])) * s };
  });
  const ordenado = todos.slice().sort((a, b) => Math.abs(b.impactoCent) - Math.abs(a.impactoCent));
  const top = ordenado.slice(0, quantos);
  const demais = ordenado.slice(quantos).reduce((a, x) => a + x.impactoCent, 0);
  return { top, demaisCent: demais, totalCent: todos.reduce((a, x) => a + x.impactoCent, 0) };
}

/**
 * Cor do delta (§4): melhora é verde, piora é vermelho, irrelevante é cinza.
 *
 * "Para linhas de custo, aumento é vermelho" — a mesma variação de R$ 5 mil
 * tem cores opostas em receita e em custo, e é isso que o `inverter` resolve.
 * Abaixo de R$ 1 não pinta nada: variação de centavo não é notícia.
 */
export function tomDoDelta(deltaCent: number, inverter = false): "bom" | "ruim" | "neutro" {
  const d = cent(deltaCent);
  if (Math.abs(d) < 100) return "neutro";
  const positivo = d > 0;
  return (inverter ? !positivo : positivo) ? "bom" : "ruim";
}

/* ── Saúde do cliente (§6.4) ───────────────────────────────────────────── */

export type Saude = "saudavel" | "atencao" | "critica" | "sem-dados";

export const LIMITES_SAUDE = { saudavel: 55, atencao: 40 };

/**
 * Classifica a margem de contribuição do cliente.
 *
 * Os limites são altos de propósito: a margem de contribuição **não** desconta
 * estrutura, então 55% aqui não é 55% de margem líquida. Comparar com o número
 * de uma DRE levaria a cortar cliente que paga a estrutura.
 */
export function saudeDaMargem(margemPct: number | null): Saude {
  if (margemPct == null || !Number.isFinite(margemPct)) return "sem-dados";
  if (margemPct >= LIMITES_SAUDE.saudavel) return "saudavel";
  if (margemPct >= LIMITES_SAUDE.atencao) return "atencao";
  return "critica";
}

/* ── Simulador de preço (§8.2) ─────────────────────────────────────────── */

/**
 * Fee necessário para atingir uma margem alvo, com o mesmo custo mensal.
 *
 * fee = custo ÷ ((1 − alíquota) × (1 − margem alvo)).
 */
export function feeParaMargem(custoMensalCent: number, aliquotaPct: number, margemAlvoPct: number): number | null {
  const liquidoPorReal = (1 - aliquotaPct / 100) * (1 - margemAlvoPct / 100);
  if (liquidoPorReal <= 0) return null;
  return Math.round(cent(custoMensalCent) / liquidoPorReal);
}

/** Margem que um fee produz, dado o custo mensal. */
export function margemComFee(feeCent: number, custoMensalCent: number, aliquotaPct: number): number | null {
  const liquido = cent(feeCent) * (1 - aliquotaPct / 100);
  if (liquido <= 0) return null;
  return Math.round(((liquido - cent(custoMensalCent)) / liquido) * 1000) / 10;
}

/* ── Concentração (§7.5) ───────────────────────────────────────────────── */

export const LIMITE_CONCENTRACAO_PCT = 15;

export type LinhaConcentracao = { nome: string; receitaCent: number; pct: number; acumuladoPct: number; acima: boolean };

export function concentracao(
  clientes: { nome: string; receitaCent: number }[],
  quantos = 8,
  limitePct = LIMITE_CONCENTRACAO_PCT,
): LinhaConcentracao[] {
  const total = clientes.reduce((a, c) => a + cent(c.receitaCent), 0);
  if (total <= 0) return [];
  let acum = 0;
  return clientes
    .slice()
    .sort((a, b) => cent(b.receitaCent) - cent(a.receitaCent))
    .slice(0, quantos)
    .map((c) => {
      const pct = Math.round((cent(c.receitaCent) / total) * 1000) / 10;
      acum = Math.round((acum + pct) * 10) / 10;
      return { nome: c.nome, receitaCent: cent(c.receitaCent), pct, acumuladoPct: acum, acima: pct > limitePct };
    });
}

/* ── Invariantes (§10) ─────────────────────────────────────────────────── */

/** Tolerância das provas de fechamento: R$ 1. */
export const TOLERANCIA_CENT = 100;

/**
 * Rentabilidade fecha com a DRE? (§10.1 e §15.4 do documento-mãe)
 *
 * Σ margem de contribuição − ociosidade − operação geral − despesas ± financeiro
 * = resultado líquido.
 *
 * A spec é explícita: divergência é bug, não arredondamento. Por isso a
 * tolerância é R$ 1 e não um percentual — um erro proporcional cresceria junto
 * com a empresa e nunca dispararia.
 */
export function rentabilidadeFechaComDre(input: {
  margemClientesCent: number;
  ociosidadeCent: number;
  operacaoGeralCent: number;
  despesasOperacionaisCent: number;
  resultadoFinanceiroCent: number;
  resultadoLiquidoDreCent: number;
}): { confere: boolean; diferencaCent: number } {
  const calculado =
    cent(input.margemClientesCent) -
    cent(input.ociosidadeCent) -
    cent(input.operacaoGeralCent) -
    cent(input.despesasOperacionaisCent) +
    cent(input.resultadoFinanceiroCent);
  const dif = calculado - cent(input.resultadoLiquidoDreCent);
  return { confere: Math.abs(dif) <= TOLERANCIA_CENT, diferencaCent: dif };
}

/**
 * A ponte do resultado ao caixa fecha com o Caixa? (§10.2)
 *
 * resultado líquido + variações = variação do saldo disponível.
 */
export function ponteFechaComCaixa(
  resultadoLiquidoCent: number,
  variacoesCent: number[],
  variacaoDisponivelCent: number,
): { confere: boolean; diferencaCent: number } {
  const calculado = cent(resultadoLiquidoCent) + (variacoesCent ?? []).reduce((a, v) => a + cent(v), 0);
  const dif = calculado - cent(variacaoDisponivelCent);
  return { confere: Math.abs(dif) <= TOLERANCIA_CENT, diferencaCent: dif };
}

/* ── Custo por vaga (§15.1 do documento-mãe) ───────────────────────────── */

/**
 * Custo de uma vaga de equipe e a ociosidade da função.
 *
 * Divide pela **capacidade**, não pelo número de clientes atendidos. Dividir
 * pelos atuais faria um cliente parecer menos rentável só porque a agência
 * perdeu outro — e a conta esconderia a informação que interessa, que é a
 * ocupação da equipe. Acima da capacidade o divisor passa a ser o real, senão
 * a soma das vagas ultrapassaria o custo da função.
 */
export function custoPorVaga(custoFuncaoCent: number, capacidade: number, vagasUsadas: number): {
  custoVagaCent: number;
  ociosidadeCent: number;
  acimaDaCapacidade: boolean;
} {
  const custo = cent(custoFuncaoCent);
  const divisor = Math.max(capacidade || 0, vagasUsadas || 0);
  if (divisor <= 0) {
    // Capacidade zero: tudo vira ociosidade até alguém definir a capacidade.
    return { custoVagaCent: 0, ociosidadeCent: custo, acimaDaCapacidade: false };
  }
  const porVaga = Math.round(custo / divisor);
  const usada = Math.round(porVaga * (vagasUsadas || 0));
  return {
    custoVagaCent: porVaga,
    ociosidadeCent: Math.max(0, custo - usada),
    acimaDaCapacidade: (vagasUsadas || 0) > (capacidade || 0),
  };
}

/* ── Movimentos de MRR (§7.2) ──────────────────────────────────────────── */

export type TipoMovimentoMrr = "new" | "reactivation" | "expansion" | "contraction" | "churn" | "pause" | "resume";

export const MOVIMENTOS_MRR: { key: TipoMovimentoMrr; label: string; tom: "bom" | "ruim" | "neutro" }[] = [
  { key: "new", label: "Novo", tom: "bom" },
  { key: "reactivation", label: "Reativação", tom: "bom" },
  { key: "expansion", label: "Expansão", tom: "bom" },
  { key: "resume", label: "Retomada", tom: "bom" },
  { key: "contraction", label: "Contração", tom: "ruim" },
  { key: "churn", label: "Churn", tom: "ruim" },
  // Pausa é cinza de propósito: sai do MRR mas não é perda de cliente, e
  // contá-la como churn inflaria o indicador que dispara o alerta de 2%.
  { key: "pause", label: "Pausa", tom: "neutro" },
];

/** Churn de MRR em % do MRR inicial. Acima de 2% ao mês é alerta (§14). */
export const LIMITE_CHURN_PCT = 2;

export function churnDeMrr(perdidoPorChurnCent: number, mrrInicialCent: number): { pct: number | null; alerta: boolean } {
  const ini = cent(mrrInicialCent);
  if (ini <= 0) return { pct: null, alerta: false };
  const pct = Math.round((Math.abs(cent(perdidoPorChurnCent)) / ini) * 1000) / 10;
  return { pct, alerta: pct > LIMITE_CHURN_PCT };
}
