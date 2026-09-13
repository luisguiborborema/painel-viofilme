/**
 * Configuração do lead score.
 *
 * O score já existia, com sete fatores e pesos fixos no código. Mudar exigia
 * deploy, então na prática ninguém mudava — e um score que não reflete como a
 * agência qualifica vira um número decorativo que as pessoas aprendem a ignorar.
 *
 * A escolha aqui foi tornar configuráveis os fatores que já existem, em vez de
 * oferecer um construtor de regras genérico (campo / operador / valor). Regra
 * genérica parece mais poderosa e é pior na prática: exige inventar critérios
 * do zero, erra silenciosamente quando o campo muda de nome, e ninguém sabe
 * dizer por que o score deu 63.
 *
 * Client-safe: só tipos e cálculo puro.
 */

export type ConfigLeadScore = {
  /** Valor mensal: quanto vale cada faixa. */
  valorAlto: { minimo: number; pontos: number };
  valorMedio: { minimo: number; pontos: number };
  valorBaixo: { pontos: number };
  /** Pontos por item de BANT preenchido (orçamento, autoridade, necessidade, prazo). */
  pontosPorBant: number;
  /** Peso máximo da probabilidade da etapa. */
  pesoEtapa: number;
  /** Origem que a agência considera quente (busca por trecho, sem acento). */
  origemQuente: { termo: string; pontos: number };
  /** Engajamento por recência da última interação. */
  engajamento: { ateDias: number; pontos: number }[];
  /** Contatabilidade. */
  pontosTelefone: number;
  pontosEmail: number;
  /** Cortes das faixas. */
  corteQuente: number;
  corteMorno: number;
};

/** Os pesos que o código usava antes de isto existir. Mudar aqui muda o padrão. */
export const CONFIG_PADRAO: ConfigLeadScore = {
  valorAlto: { minimo: 5000, pontos: 25 },
  valorMedio: { minimo: 2000, pontos: 16 },
  valorBaixo: { pontos: 8 },
  pontosPorBant: 5,
  pesoEtapa: 20,
  origemQuente: { termo: "indica", pontos: 10 },
  engajamento: [
    { ateDias: 2, pontos: 15 },
    { ateDias: 7, pontos: 10 },
    { ateDias: 14, pontos: 4 },
  ],
  pontosTelefone: 5,
  pontosEmail: 5,
  corteQuente: 70,
  corteMorno: 40,
};

const num = (v: unknown, padrao: number, max = 100) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return padrao;
  return Math.min(Math.round(n), max);
};

/**
 * Normaliza o que veio do banco, campo a campo.
 *
 * Configuração salva por uma versão anterior pode estar incompleta; cada campo
 * ausente cai no padrão em vez de zerar o fator. Zerar em silêncio faria o
 * score cair para todo mundo sem ninguém entender por quê.
 */
export function normalizarConfig(raw: unknown): ConfigLeadScore {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = CONFIG_PADRAO;
  const faixa = (v: unknown, d: { minimo: number; pontos: number }) => {
    const x = (v ?? {}) as Record<string, unknown>;
    return { minimo: num(x.minimo, d.minimo, 1_000_000), pontos: num(x.pontos, d.pontos, 50) };
  };

  const eng = Array.isArray(o.engajamento) && o.engajamento.length
    ? (o.engajamento as Record<string, unknown>[])
        .map((e) => ({ ateDias: num(e.ateDias, 7, 365), pontos: num(e.pontos, 0, 50) }))
        .filter((e) => e.ateDias > 0)
        .sort((a, b) => a.ateDias - b.ateDias)
        .slice(0, 6)
    : p.engajamento;

  const origem = (o.origemQuente ?? {}) as Record<string, unknown>;
  const corteMorno = num(o.corteMorno, p.corteMorno);
  // Quente nunca pode ficar abaixo de morno: as faixas se invertem e todo lead
  // vira "quente" ou nenhum vira.
  const corteQuente = Math.max(corteMorno + 1, num(o.corteQuente, p.corteQuente));

  return {
    valorAlto: faixa(o.valorAlto, p.valorAlto),
    valorMedio: faixa(o.valorMedio, p.valorMedio),
    valorBaixo: { pontos: num((o.valorBaixo as Record<string, unknown>)?.pontos, p.valorBaixo.pontos, 50) },
    pontosPorBant: num(o.pontosPorBant, p.pontosPorBant, 25),
    pesoEtapa: num(o.pesoEtapa, p.pesoEtapa, 50),
    origemQuente: {
      termo: String(origem.termo ?? p.origemQuente.termo).trim().slice(0, 40) || p.origemQuente.termo,
      pontos: num(origem.pontos, p.origemQuente.pontos, 50),
    },
    engajamento: eng,
    pontosTelefone: num(o.pontosTelefone, p.pontosTelefone, 25),
    pontosEmail: num(o.pontosEmail, p.pontosEmail, 25),
    corteQuente,
    corteMorno,
  };
}

/** Compara ignorando acento e caixa — "Indicação" casa com "indica". */
function contem(texto: string, termo: string): boolean {
  const limpa = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return limpa(texto).includes(limpa(termo));
}

export type EntradaScore = {
  monthlyValue: number;
  bant?: Partial<Record<"budget" | "authority" | "need" | "timing", string>>;
  probability: number;
  source?: string | null;
  diasDesdeInteracao?: number | null;
  temTelefone: boolean;
  temEmail: boolean;
};

export type ResultadoScore = {
  score: number;
  tier: "hot" | "warm" | "cold";
  factors: { label: string; points: number }[];
};

/** Calcula o score. Fator que soma zero não entra na lista — só faria ruído. */
export function calcularScore(d: EntradaScore, cfg: ConfigLeadScore = CONFIG_PADRAO): ResultadoScore {
  const factors: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => {
    if (points) factors.push({ label, points });
  };

  const v = Number(d.monthlyValue) || 0;
  add(
    "Valor mensal",
    v >= cfg.valorAlto.minimo ? cfg.valorAlto.pontos
      : v >= cfg.valorMedio.minimo ? cfg.valorMedio.pontos
        : v > 0 ? cfg.valorBaixo.pontos : 0,
  );

  const bantFilled = (["budget", "authority", "need", "timing"] as const)
    .filter((k) => d.bant?.[k]?.trim()).length;
  add("Qualificação (BANT)", bantFilled * cfg.pontosPorBant);

  add("Estágio no funil", Math.round(((Number(d.probability) || 0) / 100) * cfg.pesoEtapa));

  if (d.source && contem(d.source, cfg.origemQuente.termo)) {
    add("Origem quente", cfg.origemQuente.pontos);
  }

  if (typeof d.diasDesdeInteracao === "number" && d.diasDesdeInteracao >= 0) {
    // A primeira faixa que couber vence — por isso a lista vem ordenada.
    const faixa = cfg.engajamento.find((e) => d.diasDesdeInteracao! <= e.ateDias);
    add("Engajamento recente", faixa?.pontos ?? 0);
  }

  add("Telefone", d.temTelefone ? cfg.pontosTelefone : 0);
  add("E-mail", d.temEmail ? cfg.pontosEmail : 0);

  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  return {
    score,
    tier: score >= cfg.corteQuente ? "hot" : score >= cfg.corteMorno ? "warm" : "cold",
    factors,
  };
}

/**
 * Soma dos pesos máximos.
 *
 * O score é limitado a 100. Se a configuração somar menos, nenhum lead chega ao
 * corte de quente; se somar muito mais, quase todos chegam. A tela mostra este
 * número para a escolha ser informada.
 */
export function tetoTeorico(cfg: ConfigLeadScore): number {
  const maiorEngajamento = Math.max(0, ...cfg.engajamento.map((e) => e.pontos));
  return (
    cfg.valorAlto.pontos +
    cfg.pontosPorBant * 4 +
    cfg.pesoEtapa +
    cfg.origemQuente.pontos +
    maiorEngajamento +
    cfg.pontosTelefone +
    cfg.pontosEmail
  );
}
