/**
 * Multa e juros por atraso.
 *
 * Padrão de contrato no Brasil: multa única de 2% sobre o valor e juros de
 * mora de 1% ao mês, proporcionais aos dias (art. 52 §1º do CDC limita a multa
 * a 2% em relação de consumo; entre empresas o contrato manda, mas 2% é o uso).
 * A carência existe porque cobrar juros de um atraso de um dia útil costuma
 * custar mais em relacionamento do que rende.
 */

export type EncargosConfig = {
  /** Multa percentual única sobre o principal. 0 desliga. */
  fine: number;
  /** Juros percentuais ao mês, proporcionais por dia. 0 desliga. */
  interestMonth: number;
  /** Dias de atraso tolerados antes de qualquer cobrança. */
  graceDays: number;
};

export const ENCARGOS_PADRAO: EncargosConfig = { fine: 0, interestMonth: 0, graceDays: 0 };

export type Encargos = {
  diasAtraso: number;
  /** Dias efetivamente cobrados (já descontada a carência). */
  diasCobrados: number;
  multa: number;
  juros: number;
  total: number;
  /** Principal + encargos. */
  atualizado: number;
};

const cent = (v: number) => Math.round(v * 100) / 100;

/** Dias corridos entre o vencimento e a data de referência (negativo = a vencer). */
export function diasDeAtraso(vencimento: string, hoje = new Date()): number {
  const v = new Date(`${vencimento}T00:00:00Z`).getTime();
  const h = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.floor((h - v) / 86_400_000);
}

/**
 * Calcula os encargos de um título vencido.
 *
 * Juros pro rata die: (taxa mensal / 30) × dias. É o critério usado por banco e
 * o que a maioria dos contratos descreve como "juros de mora de 1% ao mês".
 */
export function calcularEncargos(
  principal: number,
  vencimento: string,
  cfg: EncargosConfig = ENCARGOS_PADRAO,
  hoje = new Date(),
): Encargos {
  const diasAtraso = diasDeAtraso(vencimento, hoje);
  const vazio: Encargos = {
    diasAtraso: Math.max(0, diasAtraso),
    diasCobrados: 0, multa: 0, juros: 0, total: 0, atualizado: cent(principal),
  };
  if (diasAtraso <= 0 || principal <= 0) return vazio;

  const diasCobrados = Math.max(0, diasAtraso - Math.max(0, Math.round(cfg.graceDays)));
  if (diasCobrados === 0) return vazio;

  const multa = cfg.fine > 0 ? cent(principal * (cfg.fine / 100)) : 0;
  const juros = cfg.interestMonth > 0 ? cent(principal * (cfg.interestMonth / 100 / 30) * diasCobrados) : 0;
  const total = cent(multa + juros);

  return { diasAtraso, diasCobrados, multa, juros, total, atualizado: cent(principal + total) };
}

/** Texto curto para mostrar na cobrança e no WhatsApp. */
export function descreverEncargos(e: Encargos, cfg: EncargosConfig): string | null {
  if (e.total <= 0) return null;
  const partes: string[] = [];
  if (e.multa > 0) partes.push(`multa de ${cfg.fine}%`);
  if (e.juros > 0) partes.push(`juros de ${cfg.interestMonth}% a.m. por ${e.diasCobrados} dia(s)`);
  return partes.join(" + ");
}
