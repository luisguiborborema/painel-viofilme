/**
 * Kanban de postagens da linha editorial.
 *
 * O fluxo antigo pedia ~20 campos por post numa ficha modal. Aqui o card nasce
 * aberto com os seis campos que importam e o social media preenche direto na
 * coluna. A ficha completa continua existindo no menu do card, para decupagem e
 * moodboard — que alimentam a apresentação ao cliente.
 *
 * Client-safe: só tipos e regras puras.
 */
import type { EditorialFormat } from "./operacao";

/** Formato de postagem, incluindo o balde de pedidos fora do padrão. */
export type TipoPostagem = EditorialFormat | "Extra";

export type ColunaKanban = {
  /** Valor gravado em `editorial_posts.format`. */
  tipo: TipoPostagem;
  /** Cabeçalho da coluna. */
  label: string;
  /** Etiqueta do card. */
  badge: string;
  cor: string;
  hint?: string;
};

/**
 * Ordem das colunas = ordem de importância no contrato. Extras por último
 * porque é exceção, não rotina.
 */
export const COLUNAS: ColunaKanban[] = [
  { tipo: "Reels",     label: "Reels",         badge: "REEL",     cor: "#f43f5e" },
  { tipo: "Carrossel", label: "Carrosséis",    badge: "CARROSSEL", cor: "#3b82f6" },
  { tipo: "Feed",      label: "Posts simples", badge: "POST",     cor: "#10b981" },
  { tipo: "Stories",   label: "Stories",       badge: "STORIES",  cor: "#a855f7" },
  {
    tipo: "Extra",
    label: "Extras",
    badge: "EXTRA",
    cor: "#94a3b8",
    hint: "pedidos fora do escopo padrão",
  },
];

export const TIPOS = COLUNAS.map((c) => c.tipo);
const TIPOS_SET = new Set<string>(TIPOS);

/** Formato desconhecido (dado antigo) cai em Extras, onde fica visível. */
export function tipoDoPost(format: string | null | undefined): TipoPostagem {
  const f = String(format ?? "");
  return TIPOS_SET.has(f) ? (f as TipoPostagem) : "Extra";
}

/* --------------------------- Card pronto ou não ---------------------------- */

/**
 * O que um card precisa ter para ser considerado pronto.
 *
 * Link de referência é o único opcional — está no briefing e faz sentido: nem
 * todo post nasce de uma referência visual.
 */
export const CAMPOS_OBRIGATORIOS = [
  { key: "title", label: "Título" },
  { key: "description", label: "Roteiro" },
  { key: "legenda", label: "Legenda" },
  { key: "deliveryDate", label: "Data de entrega" },
  { key: "postDateIso", label: "Data de postagem" },
  { key: "assignee", label: "Responsável" },
] as const;

export type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number]["key"];

export type CardParaValidar = Partial<Record<CampoObrigatorio, unknown>>;

/** Campos que faltam preencher — vazio quer dizer pronto. */
export function camposFaltando(card: CardParaValidar): string[] {
  return CAMPOS_OBRIGATORIOS.filter(({ key }) => {
    const v = card[key];
    return v === undefined || v === null || String(v).trim() === "";
  }).map((c) => c.label);
}

export function cardPronto(card: CardParaValidar): boolean {
  return camposFaltando(card).length === 0;
}

/** Frase para a tela: "faltam Roteiro e Responsável". */
export function descreverPendencias(card: CardParaValidar): string | null {
  const faltam = camposFaltando(card);
  if (faltam.length === 0) return null;
  if (faltam.length === 1) return `falta ${faltam[0]}`;
  return `faltam ${faltam.slice(0, -1).join(", ")} e ${faltam.at(-1)}`;
}

/* ------------------------- Quantidades da etapa 1 -------------------------- */

export type Quantidades = Record<TipoPostagem, number>;

export const QUANTIDADES_ZERADAS = (): Quantidades =>
  Object.fromEntries(TIPOS.map((t) => [t, 0])) as Quantidades;

/**
 * Quanto ainda falta entregar de cada tipo, para pré-preencher a etapa 1.
 *
 * Parte do contrato e desconta o que já existe na linha. Um mês novo começa com
 * o contrato inteiro; uma linha em andamento sugere só o que falta. Extras não
 * tem contrato — nasce em zero, porque é exceção pedida, não planejada.
 */
export function quantidadesSugeridas(
  contrato: { format: string; monthlyQty: number }[],
  jaCriados: { format?: string | null }[] = [],
): Quantidades {
  const feitos = QUANTIDADES_ZERADAS();
  for (const p of jaCriados) feitos[tipoDoPost(p.format)] += 1;

  const out = QUANTIDADES_ZERADAS();
  for (const c of contrato) {
    const t = tipoDoPost(c.format);
    if (t === "Extra") continue;
    const qtd = Math.max(0, Math.round(Number(c.monthlyQty) || 0));
    out[t] = Math.max(0, qtd - feitos[t]);
  }
  return out;
}

/** Limite por tipo numa criação — evita gerar centenas de cards por engano. */
export const MAX_POR_TIPO = 30;

export function normalizarQuantidade(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_POR_TIPO);
}

/** Total de cards que a etapa 1 vai criar. */
export function totalDeCards(q: Quantidades): number {
  return TIPOS.reduce((s, t) => s + normalizarQuantidade(q[t]), 0);
}

/**
 * Lista de cards a criar, na ordem das colunas.
 * `nInicial` é o próximo número livre da linha — os cards antigos mantêm o seu.
 */
export function planejarCards(q: Quantidades, nInicial = 1): { n: number; format: TipoPostagem }[] {
  const out: { n: number; format: TipoPostagem }[] = [];
  let n = Math.max(1, Math.round(nInicial) || 1);
  for (const tipo of TIPOS) {
    for (let i = 0; i < normalizarQuantidade(q[tipo]); i++) out.push({ n: n++, format: tipo });
  }
  return out;
}
