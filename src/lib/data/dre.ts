/**
 * DRE gerencial — tipos e regras de período.
 *
 * Client-safe (sem banco): a tela usa os mesmos rótulos e o mesmo cálculo de
 * variação que o servidor, sem duplicar regra.
 */
/** Status que NÃO entram na receita (estorno, chargeback, excluído). */
export const STATUS_IGNORAR = new Set(["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "DELETED"]);
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type DrePeriodo = "mes" | "trimestre" | "ano";

/**
 * Regime do DRE:
 *  • competencia — pela data de VENCIMENTO. Mensalidade de agosto paga em
 *    setembro pertence a agosto. É a leitura contábil do resultado.
 *  • caixa — pela data de PAGAMENTO, contando só o que foi liquidado. É a
 *    leitura de quanto dinheiro de fato entrou e saiu.
 */
export type DreRegime = "competencia" | "caixa";

export const DRE_REGIMES: { key: DreRegime; label: string; hint: string }[] = [
  { key: "competencia", label: "Competência", hint: "Pelo vencimento — o resultado do período" },
  { key: "caixa", label: "Caixa", hint: "Pelo pagamento — o dinheiro que entrou e saiu" },
];

/** Uma linha de custo/dedução: vem de uma categoria cadastrada. */
export type DreCategoriaLinha = { key: string; label: string; value: number };

export type DreLinha = {
  grossRevenue: number;
  /** Deduções (categorias com grupo "deducao"), somadas. */
  taxes: number;
  taxPct: number;
  netRevenue: number;
  /** Uma linha por categoria de dedução com movimento. */
  deducoes: DreCategoriaLinha[];
  /** Uma linha por categoria de custo com movimento. */
  custos: DreCategoriaLinha[];
  totalCosts: number;
  netProfit: number;
  margin: number;
};

export type DreResultado = {
  periodo: DrePeriodo;
  label: string;
  from: string;
  to: string;
  atual: DreLinha;
  anterior: DreLinha;
  labelAnterior: string;
  metaMargin: number;
  regime: DreRegime;
  /** Bateu no teto de leitura: os totais estão INCOMPLETOS. */
  truncado?: boolean;
  /** Receita e lucro mês a mês dentro do período (para o gráfico). */
  serie: { mes: string; receita: number; custos: number; lucro: number }[];
  topExpenses: { label: string; value: number }[];
  revenueByClient: { name: string; value: number }[];
  semDados: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Intervalo [from, to] do período que contém `ref`, e o período anterior. */
export function intervalo(periodo: DrePeriodo, ref = new Date()) {
  const a = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  if (periodo === "ano") {
    return {
      from: iso(new Date(Date.UTC(a, 0, 1))),
      to: iso(new Date(Date.UTC(a, 11, 31))),
      label: String(a),
      prevFrom: iso(new Date(Date.UTC(a - 1, 0, 1))),
      prevTo: iso(new Date(Date.UTC(a - 1, 11, 31))),
      prevLabel: String(a - 1),
    };
  }
  if (periodo === "trimestre") {
    const tri = Math.floor(m / 3);
    const ini = tri * 3;
    return {
      from: iso(new Date(Date.UTC(a, ini, 1))),
      to: iso(new Date(Date.UTC(a, ini + 3, 0))),
      label: `${tri + 1}º trimestre ${a}`,
      prevFrom: iso(new Date(Date.UTC(a, ini - 3, 1))),
      prevTo: iso(new Date(Date.UTC(a, ini, 0))),
      prevLabel: tri === 0 ? `4º trimestre ${a - 1}` : `${tri}º trimestre ${a}`,
    };
  }
  return {
    from: iso(new Date(Date.UTC(a, m, 1))),
    to: iso(new Date(Date.UTC(a, m + 1, 0))),
    label: `${MESES_CURTOS[m]}/${String(a).slice(2)}`,
    prevFrom: iso(new Date(Date.UTC(a, m - 1, 1))),
    prevTo: iso(new Date(Date.UTC(a, m, 0))),
    prevLabel: `${MESES_CURTOS[(m + 11) % 12]}/${String(m === 0 ? a - 1 : a).slice(2)}`,
  };
}


/** Variação percentual entre dois valores (null quando não faz sentido). */
export function variacao(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return atual > 0 ? 100 : null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}
