/**
 * Casamento entre o extrato do banco e os lançamentos do painel.
 *
 * A regra é conservadora de propósito: só casa sozinho quando não há dúvida.
 * Um casamento errado é pior que nenhum — ele esconde uma divergência real e
 * ainda dá a sensação de que está tudo conferido.
 */

export type CandidatoMov = {
  /** "p-<uuid>" (recebimento) ou "e-<uuid>" (despesa). */
  id: string;
  kind: "entrada" | "saida";
  /** Data de liquidação, se houver; senão o vencimento. */
  date: string;
  /** Sempre positivo. */
  value: number;
  description: string;
  /** Já casado com outra linha do extrato? */
  jaCasado?: boolean;
};

export type LinhaExtrato = {
  id: string;
  date: string;
  amount: number;   // com sinal
  memo: string;
};

export type Sugestao = {
  entryId: string;
  movId: string;
  /** Distância em dias entre extrato e lançamento. */
  dias: number;
  /** Casou sozinho (candidato único) ou precisa de confirmação. */
  automatico: boolean;
  /** Outros candidatos igualmente plausíveis, quando houve empate. */
  alternativas: string[];
};

export type ResultadoConciliacao = {
  sugestoes: Sugestao[];
  /** Linhas do extrato sem nenhum lançamento correspondente. */
  semCandidato: string[];
};

export type OpcoesConciliacao = {
  /** Diferença máxima de valor aceita, em reais. */
  tolerancia?: number;
  /** Janela de dias entre a data do banco e a do lançamento. */
  janelaDias?: number;
};

const dias = (a: string, b: string) =>
  Math.round(Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000);

/**
 * Casa cada linha do extrato com no máximo um lançamento.
 *
 * Critérios: mesmo sinal, valor dentro da tolerância e data dentro da janela.
 * Vence o mais próximo em data; havendo empate exato, ninguém casa sozinho — a
 * linha vira sugestão com alternativas para a pessoa escolher.
 *
 * Um lançamento só pode ser usado uma vez, mesmo com valores repetidos (três
 * mensalidades idênticas no mesmo dia não podem casar todas com um débito só).
 */
export function conciliar(
  extrato: LinhaExtrato[],
  movimentos: CandidatoMov[],
  opts: OpcoesConciliacao = {},
): ResultadoConciliacao {
  const tolerancia = opts.tolerancia ?? 0.01;
  const janela = opts.janelaDias ?? 5;

  const usados = new Set<string>(movimentos.filter((m) => m.jaCasado).map((m) => m.id));
  const sugestoes: Sugestao[] = [];
  const semCandidato: string[] = [];

  // Ordena o extrato por data para que o casamento seja determinístico —
  // o mesmo arquivo importado duas vezes produz sempre o mesmo resultado.
  const linhas = [...extrato].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const linha of linhas) {
    const kind = linha.amount >= 0 ? "entrada" : "saida";
    const valor = Math.abs(linha.amount);

    const candidatos = movimentos
      .filter((m) => !usados.has(m.id) && m.kind === kind && Math.abs(m.value - valor) <= tolerancia)
      .map((m) => ({ m, d: dias(linha.date, m.date) }))
      .filter((c) => c.d <= janela)
      .sort((a, b) => a.d - b.d || a.m.id.localeCompare(b.m.id));

    if (candidatos.length === 0) { semCandidato.push(linha.id); continue; }

    const melhor = candidatos[0];
    // Empate na data = ambíguo; a máquina não escolhe por conta própria.
    const empatados = candidatos.filter((c) => c.d === melhor.d);
    const automatico = empatados.length === 1;

    usados.add(melhor.m.id);
    sugestoes.push({
      entryId: linha.id,
      movId: melhor.m.id,
      dias: melhor.d,
      automatico,
      alternativas: automatico ? [] : empatados.slice(1).map((c) => c.m.id),
    });
  }

  return { sugestoes, semCandidato };
}

/** Resumo para a tela: quanto do extrato foi explicado. */
export function resumoConciliacao(total: number, casados: number, ignorados: number) {
  const pendentes = Math.max(0, total - casados - ignorados);
  return {
    total,
    casados,
    ignorados,
    pendentes,
    pct: total > 0 ? Math.round((casados / total) * 100) : 0,
    fechado: pendentes === 0 && total > 0,
  };
}
