/**
 * Séries de contas a pagar (recorrência com parcelas reais).
 *
 * Client-safe: só datas e regras puras — sem banco. Assim a geração de
 * vencimentos pode ser testada e reusada pela UI (prévia das parcelas).
 */

export type Recurrence = "monthly" | "weekly" | "yearly";

export const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: "monthly", label: "Mensal" },
  { key: "weekly", label: "Semanal" },
  { key: "yearly", label: "Anual" },
];

/** Quantos meses de parcelas manter à frente numa série sem fim. */
export const JANELA_ABERTA_MESES = 12;
/** Teto de parcelas geradas de uma vez (evita criar 500 linhas por engano). */
export const MAX_PARCELAS = 120;

/** Último dia do mês (ano/mês 0-based), em UTC. */
function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

/**
 * Avança uma data respeitando o fim do mês.
 *
 * Vencimento em 31/jan + 1 mês = 28/fev (não 03/mar, como faria o Date puro).
 * Vencimento em 31/jan + 2 meses volta a 31/mar — o dia original é preservado
 * como referência em vez de "grudar" no dia 28.
 */
export function avancar(iso: string, recorrencia: Recurrence, passos: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;

  if (recorrencia === "weekly") {
    const base = Date.UTC(a, m - 1, d) + passos * 7 * 86_400_000;
    return new Date(base).toISOString().slice(0, 10);
  }

  const mesesPorPasso = recorrencia === "yearly" ? 12 : 1;
  const total = (m - 1) + passos * mesesPorPasso;
  const ano = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const dia = Math.min(d, ultimoDia(ano, mes));
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export type ParcelaPlanejada = { dueDate: string; installment: number };

/**
 * Datas das parcelas a partir do primeiro vencimento.
 * `quantidade` é limitada por MAX_PARCELAS.
 */
export function planejarParcelas(
  primeiroVencimento: string,
  recorrencia: Recurrence,
  quantidade: number,
): ParcelaPlanejada[] {
  const n = Math.max(1, Math.min(Math.round(quantidade) || 1, MAX_PARCELAS));
  const out: ParcelaPlanejada[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ dueDate: avancar(primeiroVencimento, recorrencia, i), installment: i + 1 });
  }
  return out;
}

/**
 * Quantas parcelas faltam gerar numa série sem fim para cobrir a janela.
 * Recebe o último vencimento já existente; devolve as datas a criar.
 */
export function completarSerieAberta(
  ultimoVencimento: string,
  recorrencia: Recurrence,
  hojeIso: string,
  janelaMeses = JANELA_ABERTA_MESES,
): string[] {
  const [ha, hm, hd] = hojeIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ha, (hm - 1) + janelaMeses, hd || 1)).toISOString().slice(0, 10);
  const novas: string[] = [];
  let cursor = ultimoVencimento;
  // Passo a passo até cobrir a janela (com teto de segurança).
  for (let i = 0; i < MAX_PARCELAS; i++) {
    const prox = avancar(cursor, recorrencia, 1);
    if (prox > alvo) break;
    novas.push(prox);
    cursor = prox;
  }
  return novas;
}
