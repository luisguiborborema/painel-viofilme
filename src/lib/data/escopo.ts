/**
 * Escopo "meus / squad / todos" das telas de operação.
 *
 * O controle existe em duas telas (Hub de Clientes e VioFlux) e em ambas o
 * botão "squad" nunca foi implementado: o filtro era
 * `scope === "meus" && !ehMeu(x)`, então "squad" e "todos" caíam no mesmo
 * lugar. Em VioFlux "squad" ainda era o padrão — a pessoa começava num botão
 * aceso que não filtrava nada.
 *
 * A origem está num comentário do próprio código: "escopo por squad modelado
 * desde já (hoje só existe 1 squad)". Com um squad só, os dois botões davam o
 * mesmo resultado e ninguém tinha como perceber que um deles era enfeite.
 *
 * Client-safe: só tipos e filtro puro.
 */

export type Escopo = "meus" | "squad" | "todos";

export const ESCOPOS: { key: Escopo; label: string; ajuda: string }[] = [
  { key: "meus", label: "meus", ajuda: "Só onde você é responsável" },
  { key: "squad", label: "squad", ajuda: "Tudo do seu squad" },
  { key: "todos", label: "todos", ajuda: "A carteira inteira" },
];

export function normalizarEscopo(v: unknown): Escopo {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "meus" || s === "squad" || s === "todos" ? s : "todos";
}

/**
 * Decide se um item entra no escopo.
 *
 * `squadDoUsuario` nulo (usuário sem squad) faz "squad" não esconder nada: é
 * melhor mostrar demais do que apresentar uma tela vazia a quem só não teve o
 * squad preenchido no cadastro.
 */
export function noEscopo(
  escopo: Escopo,
  item: { ehMeu: boolean; squadId?: string | null },
  squadDoUsuario?: string | null,
): boolean {
  if (escopo === "todos") return true;
  if (escopo === "meus") return item.ehMeu;
  if (!squadDoUsuario) return true;
  return item.squadId === squadDoUsuario;
}

/**
 * O botão "squad" só faz sentido quando distingue algo.
 *
 * Sem squad no cadastro do usuário, ou com a agência inteira num squad só, ele
 * daria exatamente o mesmo resultado de "todos" — e um controle que não muda
 * nada ensina a pessoa a desconfiar dos outros.
 */
export function escoposUteis(squadDoUsuario: string | null | undefined, squadsVisiveis: (string | null | undefined)[]): Escopo[] {
  const distintos = new Set(squadsVisiveis.filter(Boolean) as string[]);
  const vale = Boolean(squadDoUsuario) && distintos.size > 1;
  return vale ? ["meus", "squad", "todos"] : ["meus", "todos"];
}
