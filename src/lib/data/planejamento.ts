/**
 * Planejamento financeiro — linhas gerenciais, farol de desvio e metas do ano.
 *
 * **Dinheiro aqui é centavos inteiros**, como manda o §24 do documento-mãe
 * ("nunca float"). As tabelas antigas do financeiro são `numeric(12,2)` em
 * reais; a conversão acontece na fronteira, não no cálculo.
 *
 * Duas regras moram neste arquivo, e as duas têm uma sutileza que decide o
 * resultado.
 *
 * O **farol** olha desvio *desfavorável*, não desvio grande. Receita R$ 10 mil
 * acima do orçado e custo R$ 10 mil acima são o mesmo número com significados
 * opostos — por isso cada linha carrega o sinal, e a comparação inverte.
 *
 * As **metas** usam corte percentual, menos a margem: margem se mede em pontos
 * percentuais, e aplicar "98% da meta" sobre 42% daria 41,2%, diferença que
 * ninguém trata como problema. A spec separa os dois de propósito.
 *
 * Client-safe: só tipos e cálculo puro.
 */

/** Sinal da linha no resultado. */
export type SinalLinha = "receita" | "custo" | "ambos";

export type LinhaGerencial = { key: string; label: string; sinal: SinalLinha };

/** Os grupos do Orçado × realizado (spec 5.2), na ordem da tela. */
export const LINHAS_GERENCIAIS: LinhaGerencial[] = [
  { key: "receita_recorrente", label: "Receita recorrente", sinal: "receita" },
  { key: "receita_pontual", label: "Receita pontual", sinal: "receita" },
  { key: "impostos", label: "Impostos", sinal: "custo" },
  { key: "equipe_entrega", label: "Equipe de entrega", sinal: "custo" },
  { key: "variaveis_producao", label: "Custos variáveis de produção", sinal: "custo" },
  { key: "prolabore", label: "Pró-labore e encargos", sinal: "custo" },
  { key: "equipe_admin", label: "Equipe administrativa", sinal: "custo" },
  { key: "comercial", label: "Comercial e comissões", sinal: "custo" },
  { key: "estrutura", label: "Estrutura e contabilidade", sinal: "custo" },
  { key: "softwares", label: "Softwares", sinal: "custo" },
  { key: "transporte", label: "Transporte e alimentação", sinal: "custo" },
  { key: "financeiro", label: "Resultado financeiro", sinal: "ambos" },
];

export function linhaPorKey(key: string): LinhaGerencial | undefined {
  return LINHAS_GERENCIAIS.find((l) => l.key === key);
}

/* ── Farol ─────────────────────────────────────────────────────────────── */

export type Farol = "verde" | "ambar" | "vermelho" | "cinza";

/** Tolerâncias (spec 15). `absoluto` em CENTAVOS: R$ 500 = 50000. */
export type ToleranciaFarol = { percentual: number; absoluto: number };
export const TOLERANCIA_PADRAO: ToleranciaFarol = { percentual: 10, absoluto: 50_000 };

export type ResultadoDesvio = {
  /** Realizado − orçado, em centavos, com o sinal aritmético cru. */
  valor: number;
  /** Percentual sobre o orçado. `null` quando não há orçado para comparar. */
  percentual: number | null;
  /** O desvio piora o resultado? Receita abaixo ou custo acima. */
  desfavoravel: boolean;
  farol: Farol;
};

const inteiro = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

/**
 * Compara orçado e realizado de uma linha.
 *
 * Sem orçado devolve farol cinza, não 100% de desvio: categoria que ninguém
 * orçou não é estouro de orçamento, é ausência de plano — e pintar de vermelho
 * ensina o time a ignorar a cor.
 */
export function avaliarDesvio(
  orcadoCent: number,
  realizadoCent: number,
  sinal: SinalLinha,
  tol: ToleranciaFarol = TOLERANCIA_PADRAO,
): ResultadoDesvio {
  const o = inteiro(orcadoCent);
  const r = inteiro(realizadoCent);
  const valor = r - o;

  if (!o) return { valor, percentual: null, desfavoravel: false, farol: "cinza" };

  const percentual = Math.round((valor / Math.abs(o)) * 100);
  // Só o custo piora quando sobe. Receita e resultado financeiro pioram quando
  // caem: na DRE (§11 do documento-mãe) o resultado financeiro entra somando
  // (± Resultado financeiro = Resultado líquido), então menos é pior — mesmo
  // quando o número é negativo dos dois lados.
  const desfavoravel = sinal === "custo" ? valor > 0 : valor < 0;

  if (!desfavoravel) return { valor, percentual, desfavoravel, farol: "verde" };
  if (Math.abs(percentual) <= tol.percentual) return { valor, percentual, desfavoravel, farol: "verde" };
  if (Math.abs(valor) <= tol.absoluto) return { valor, percentual, desfavoravel, farol: "ambar" };
  return { valor, percentual, desfavoravel, farol: "vermelho" };
}

/** Vermelho é o que a revisão do mês obriga a explicar (spec 6, passo 1). */
export function exigeComentario(farol: Farol): boolean {
  return farol === "vermelho";
}

/* ── Metas do ano (spec 5.1) ───────────────────────────────────────────── */

export type Kpi = "mrr_end" | "revenue_year" | "op_margin" | "result_year" | "min_cash";

export const KPIS: { key: Kpi; label: string; emPontos: boolean }[] = [
  { key: "mrr_end", label: "MRR em dezembro", emPontos: false },
  { key: "revenue_year", label: "Receita do ano", emPontos: false },
  { key: "op_margin", label: "Margem operacional", emPontos: true },
  { key: "result_year", label: "Resultado do ano", emPontos: false },
  { key: "min_cash", label: "Caixa mínimo", emPontos: false },
];

export type NivelMeta = "verde" | "ambar" | "vermelho" | "sem-meta";

export const CORTES_PADRAO = { verde: 98, ambar: 92 };
/** Margem é medida em pontos percentuais, não em % da meta. */
export const CORTES_MARGEM = { verde: 0.5, ambar: 2 };

/**
 * Cor do cartão de meta, a partir do "no ritmo" (o projetado), não do atual.
 *
 * O atual sempre parece ruim em janeiro e sempre parece bom em dezembro. O que
 * informa é onde o ano termina se nada mudar.
 */
export function avaliarMeta(noRitmo: number | null, meta: number, kpi: Kpi): NivelMeta {
  if (!meta || noRitmo == null || !Number.isFinite(noRitmo)) return "sem-meta";

  if (kpi === "op_margin") {
    const distancia = meta - noRitmo; // pontos percentuais
    if (distancia <= CORTES_MARGEM.verde) return "verde";
    if (distancia <= CORTES_MARGEM.ambar) return "ambar";
    return "vermelho";
  }

  const pct = (noRitmo / meta) * 100;
  if (pct >= CORTES_PADRAO.verde) return "verde";
  if (pct >= CORTES_PADRAO.ambar) return "ambar";
  return "vermelho";
}

/** Progresso da barra: atual ÷ meta, travado em 0–100 para não estourar. */
export function progressoDaMeta(atual: number, meta: number): number {
  if (!meta) return 0;
  return Math.max(0, Math.min(100, Math.round((atual / meta) * 100)));
}

/* ── Versões (spec 5.4) ────────────────────────────────────────────────── */

export type StatusVersao = "draft" | "approved" | "archived";

/**
 * A versão que vale para comparar: sempre a `approved` mais recente.
 *
 * Um ano tem no máximo uma aprovada vigente e várias arquivadas (as revisões
 * anteriores), que continuam consultáveis.
 */
export function versaoVigente<T extends { status: string; approvedAt?: string | null }>(
  versoes: T[],
): T | undefined {
  return (versoes ?? [])
    .filter((v) => v.status === "approved")
    .sort((a, b) => String(b.approvedAt ?? "").localeCompare(String(a.approvedAt ?? "")))[0];
}

/** Rótulo do estado do orçamento, para o cabeçalho da página. */
export function rotuloDaVersao(
  v: { year: number; name?: string | null; status: string; approvedAt?: string | null } | undefined,
): string {
  if (!v) return "Nenhum orçamento aprovado";
  const nome = v.name?.trim() || `Orçamento ${v.year}`;
  if (v.status !== "approved") return `${nome} (rascunho)`;
  const quando = v.approvedAt ? new Date(v.approvedAt).toLocaleDateString("pt-BR") : null;
  return quando ? `${nome}, aprovado em ${quando}` : nome;
}

/* ── Faixa da rotina (spec 4) ──────────────────────────────────────────── */

export type Ritmo = "mensal" | "trimestral" | "anual" | "em-dia";

export type PassoDaRotina = {
  ritmo: Ritmo;
  titulo: string;
  subtitulo: string;
  acao: "revisao" | "comparar" | "orcamento" | null;
};

export type EstadoRotina = {
  /** Mês fechado mais recente sem revisão concluída (1–12), ou null. */
  mesPendente: number | null;
  desviosPendentes: number;
  /** Já existe orçamento aprovado para o ano que vem? */
  temOrcamentoProximoAno: boolean;
  /** Mês corrente (1–12) e dia, no fuso de São Paulo. */
  mesAtual: number;
  /** Quem e quando concluiu a última revisão. */
  ultimaRevisao?: { por: string; em: string } | null;
};

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * O próximo passo do ciclo — um só.
 *
 * A prioridade é mensal > trimestral > anual (spec 4). Mostrar três pendências
 * ao mesmo tempo devolve ao usuário a decisão que a faixa existe para tomar.
 */
export function proximoPasso(e: EstadoRotina): PassoDaRotina {
  if (e.mesPendente) {
    const mes = MESES[e.mesPendente] ?? "";
    return e.desviosPendentes > 0
      ? {
          ritmo: "mensal",
          titulo: `Revisão de ${mes}: ${e.desviosPendentes} ${e.desviosPendentes === 1 ? "desvio" : "desvios"} para comentar`,
          subtitulo: "Leva uns 15 minutos.",
          acao: "revisao",
        }
      : {
          ritmo: "mensal",
          titulo: `Nenhum desvio relevante em ${mes}`,
          subtitulo: "A revisão tem só a conferência das metas.",
          acao: "revisao",
        };
  }

  // Trimestral: depois do fechamento de mar, jun, set e dez.
  if ([4, 7, 10, 1].includes(e.mesAtual)) {
    const tri = { 4: "1º", 7: "2º", 10: "3º", 1: "4º" }[e.mesAtual];
    return {
      ritmo: "trimestral",
      titulo: `Revisão do ${tri} trimestre: manter o orçamento ou criar uma revisão?`,
      subtitulo: "Compare o orçado com a projeção antes de decidir.",
      acao: "comparar",
    };
  }

  if (e.mesAtual >= 11 && !e.temOrcamentoProximoAno) {
    return {
      ritmo: "anual",
      titulo: "Hora de montar o orçamento do ano que vem",
      subtitulo: "O assistente parte do que já está no sistema.",
      acao: "orcamento",
    };
  }

  const u = e.ultimaRevisao;
  return {
    ritmo: "em-dia",
    titulo: u ? `Revisão concluída por ${u.por}` : "Nada pendente no ciclo de planejamento",
    subtitulo: "Próxima: depois do próximo fechamento.",
    acao: null,
  };
}

/* ── Formatação ────────────────────────────────────────────────────────── */

/** Centavos → "R$ 1.234,56". */
export const brlCent = (cent: number) =>
  (inteiro(cent) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos → "R$ 1,2 mil" / "R$ 1,25 mi" — para cartões, onde o centavo é ruído. */
export function brlCurto(cent: number): string {
  const v = inteiro(cent) / 100;
  const abs = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
