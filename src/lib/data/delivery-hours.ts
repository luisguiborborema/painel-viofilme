/**
 * Apontamento de horas nas tarefas de entrega.
 *
 * `estimate_h` e `logged_h` são `numeric(5,1)` — cabem no máximo 9999,9. Passar
 * disso não dá erro de validação: o Postgres devolve "numeric field overflow",
 * que chega na tela como um 500 sem explicação. Melhor recusar antes, dizendo o
 * que houve.
 */

/** Teto da coluna numeric(5,1). */
export const MAX_HORAS = 9999.9;

export type ResultadoHoras =
  | { ok: true; total: number }
  | { ok: false; erro: string };

/**
 * Soma um lançamento ao total já apontado.
 *
 * Lançamento negativo é permitido de propósito — é como se corrige um
 * apontamento a mais. O total nunca fica negativo: quem lança −10 sobre 2h
 * zera, não fica devendo horas.
 */
export function somarHoras(totalAtual: unknown, lancamento: unknown): ResultadoHoras {
  const h = Number(lancamento);
  if (!Number.isFinite(h)) return { ok: false, erro: "Informe um número de horas válido." };
  if (h === 0) return { ok: false, erro: "Informe um valor diferente de zero." };
  if (Math.abs(h) > MAX_HORAS) {
    return { ok: false, erro: `Lançamento de ${h}h fora do limite (máximo ${MAX_HORAS}h por vez).` };
  }

  const atual = Number(totalAtual);
  const base = Number.isFinite(atual) ? atual : 0;
  const total = Math.max(0, base + h);
  if (total > MAX_HORAS) {
    return { ok: false, erro: `O total passaria de ${MAX_HORAS}h, que é o máximo que a tarefa comporta.` };
  }
  // Uma casa decimal: é o que a coluna guarda; arredondar aqui evita que o
  // banco arredonde sozinho e o total exibido divirja do lançado.
  return { ok: true, total: Math.round(total * 10) / 10 };
}

/** Estimativa informada na criação/edição da tarefa. */
export function estimativaValida(v: unknown): { ok: true; valor: number } | { ok: false; erro: string } {
  if (v === undefined || v === null || v === "") return { ok: true, valor: 0 };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { ok: false, erro: "Estimativa inválida." };
  if (n > MAX_HORAS) return { ok: false, erro: `Estimativa acima do limite (máximo ${MAX_HORAS}h).` };
  return { ok: true, valor: Math.round(n * 10) / 10 };
}
