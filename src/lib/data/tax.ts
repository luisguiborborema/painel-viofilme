/**
 * Impostos sobre o faturamento.
 *
 * O painel NÃO apura imposto — quem faz isso é a contabilidade. O que ele faz é
 * provisionar: aplicar a alíquota efetiva sobre o que foi faturado no mês para
 * que o dinheiro da guia não seja confundido com lucro. É o erro clássico de
 * agência: olhar o saldo, achar que sobrou, e esquecer que o DAS vence dia 20.
 */

export type TaxRegime = "simples" | "presumido" | "real" | "mei" | "nenhum";

export const TAX_REGIMES: { key: TaxRegime; label: string; hint: string }[] = [
  { key: "simples",   label: "Simples Nacional", hint: "DAS único, vence dia 20 do mês seguinte" },
  { key: "presumido", label: "Lucro Presumido",  hint: "PIS/COFINS/ISS/IRPJ/CSLL — use a alíquota efetiva somada" },
  { key: "real",      label: "Lucro Real",       hint: "Apuração sobre o lucro; a estimativa aqui é só provisão" },
  { key: "mei",       label: "MEI",              hint: "DAS fixo mensal — informe o valor como despesa recorrente" },
  { key: "nenhum",    label: "Não provisionar",  hint: "Desliga a estimativa de impostos" },
];

export type TaxConfig = {
  regime: TaxRegime;
  /** Alíquota efetiva sobre o faturamento, em %. */
  rate: number;
  /** Dia do mês em que a guia vence. */
  dueDay: number;
};

export const TAX_PADRAO: TaxConfig = { regime: "simples", rate: 0, dueDay: 20 };

export type Provisao = {
  /** Mês de apuração (YYYY-MM). */
  mes: string;
  faturamento: number;
  aliquota: number;
  valor: number;
  /** Vencimento da guia, no mês seguinte à apuração. */
  vencimento: string;
  ativo: boolean;
};

/**
 * Estima a guia do mês. `faturamento` é a receita reconhecida no período —
 * a mesma base do DRE, para não haver dois números concorrentes.
 */
export function estimarImposto(mes: string, faturamento: number, cfg: TaxConfig = TAX_PADRAO): Provisao {
  const ativo = cfg.regime !== "nenhum" && cfg.rate > 0 && faturamento > 0;
  const valor = ativo ? Math.round(faturamento * (cfg.rate / 100) * 100) / 100 : 0;
  return { mes, faturamento, aliquota: cfg.rate, valor, vencimento: vencimentoGuia(mes, cfg.dueDay), ativo };
}

/**
 * Vencimento da guia: dia `dueDay` do mês SEGUINTE ao da apuração.
 * Dia maior que o tamanho do mês cai no último dia (dia 31 em fevereiro).
 */
export function vencimentoGuia(mes: string, dueDay: number): string {
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  const alvoAno = m === 12 ? ano + 1 : ano;
  const alvoMes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(alvoAno, alvoMes, 0)).getUTCDate();
  const dia = Math.min(Math.max(1, Math.round(dueDay) || 20), ultimo);
  return `${alvoAno}-${String(alvoMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
