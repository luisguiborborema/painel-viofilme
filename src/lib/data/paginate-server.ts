import "server-only";

/**
 * Busca TODAS as linhas de uma consulta, em páginas.
 *
 * O problema que isto resolve: um `.limit(5000)` não dá erro quando a tabela
 * passa de 5000 — devolve 5000 e o cálculo segue como se fosse tudo. O DRE
 * fecha com um número menor, sem aviso nenhum. Em relatório financeiro, errar
 * calado é pior que falhar.
 *
 * Uso:
 *   const { linhas, truncado } = await buscarTudo<Pagamento>(
 *     (de, ate) => db.from("payments").select("value, status").range(de, ate),
 *   );
 *
 * `truncado` só volta true se o teto de segurança for atingido — aí o número
 * REALMENTE está incompleto e a tela precisa dizer isso.
 */
export type ResultadoPaginado<T> = {
  linhas: T[];
  /** Bateu no teto: existem mais linhas do que foram lidas. */
  truncado: boolean;
  /** Erro da consulta, se houve; as linhas lidas até ali vêm junto. */
  erro: { message: string } | null;
};

type Consulta = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export async function buscarTudo<T>(
  montar: (de: number, ate: number) => Consulta,
  opts: { pagina?: number; teto?: number } = {},
): Promise<ResultadoPaginado<T>> {
  // 1000 é o limite padrão de linhas por resposta do PostgREST; pedir mais em
  // uma página só não adianta. O teto existe para uma consulta mal filtrada
  // não varrer a tabela inteira e derrubar a página.
  const pagina = Math.max(1, Math.min(opts.pagina ?? 1000, 1000));
  const teto = Math.max(pagina, opts.teto ?? 50_000);

  const linhas: T[] = [];
  for (let de = 0; de < teto; de += pagina) {
    const { data, error } = await montar(de, de + pagina - 1);
    if (error) return { linhas, truncado: false, erro: error };
    const lote = (data ?? []) as T[];
    linhas.push(...lote);
    // Página incompleta significa fim dos dados — não há próxima.
    if (lote.length < pagina) return { linhas, truncado: false, erro: null };
  }
  return { linhas, truncado: true, erro: null };
}
