/**
 * Configuração editável da apresentação da Linha Editorial (por cliente,
 * clients.deck_config jsonb): tema de cores, variáveis, imagem de capa, rodapé e
 * os textos dos slides Método/Guia. Cai nos defaults do template quando vazio.
 */
export type DeckCell = { t: string; d: string };
export type DeckTheme = { blue: string; lime: string; dark: string };
export type DeckVar = { key: string; value: string };

export type DeckConfig = {
  theme: DeckTheme;
  contact: string;
  coverImageUrl?: string;
  /** Imagem opcional por slide (chave do slide → URL). */
  images: Record<string, string>;
  vars: DeckVar[];
  metodo: {
    items: string[];
    highlightTitle: string;
    highlightText: string;
    flow: string[];
  };
  guia: { cells: DeckCell[] };
};

/** Slides que aceitam uma imagem lateral no editor (capa usa coverImageUrl). */
export const DECK_IMAGE_SLIDES: { key: string; label: string }[] = [
  { key: "conceito", label: "O Conceito" },
  { key: "metodo", label: "Método" },
  { key: "visao", label: "Visão geral" },
  { key: "carrosseis", label: "Carrosséis" },
  { key: "estaticos", label: "Estáticos" },
  { key: "guia", label: "Guia de produção" },
  { key: "fechamento", label: "Fechamento" },
];

export const DEFAULT_DECK: DeckConfig = {
  theme: { blue: "#2f6ff0", lime: "#d6f24e", dark: "#191a1b" },
  contact: "contato@viofilme.com.br",
  images: {},
  vars: [],
  metodo: {
    items: [
      "Resolve um problema",
      "Gera boca a boca",
      "Tem voz e clareza",
      "Conecta com o dia a dia",
      "Deixa um sentimento",
    ],
    highlightTitle: "Autenticidade se dirige, não se finge.",
    highlightText:
      "Não é encenação — é uma situação real, com direção clara de câmera e narração. A pessoa faz o que faria de qualquer forma; a gente sabe onde apontar a câmera.",
    flow: ["PROBLEMA", "TENSÃO", "VIRADA", "SENTIMENTO"],
  },
  guia: {
    cells: [
      { t: "Câmera", d: "Câmera lenta (0,5x / 60fps), planos fechados e sensoriais — mãos, vapor, detalhe." },
      { t: "Luz e equipamento", d: "Luz natural de manhã. Tripé sempre." },
      { t: "Áudio", d: "Narração gravada à parte, em ambiente silencioso." },
      { t: "Legendas", d: "Minimalistas, brancas, palavra a palavra." },
      { t: "Trilha", d: "Suave, coerente com o tom da marca." },
      { t: "Regra-chave", d: "Situação real dirigida + só o protagonista." },
    ],
  },
};

const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v : fb);
const isHex = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

/** Mescla o jsonb salvo (parcial/qualquer) com os defaults, com formato canônico. */
export function mergeDeck(raw: unknown): DeckConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const t = (r.theme && typeof r.theme === "object" ? r.theme : {}) as Record<string, unknown>;
  const m = (r.metodo && typeof r.metodo === "object" ? r.metodo : {}) as Record<string, unknown>;
  const g = (r.guia && typeof r.guia === "object" ? r.guia : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(m.items) ? m.items : [];
  const rawFlow = Array.isArray(m.flow) ? m.flow : [];
  const rawCells = Array.isArray(g.cells) ? g.cells : [];
  const rawVars = Array.isArray(r.vars) ? r.vars : [];
  const cover = typeof r.coverImageUrl === "string" && r.coverImageUrl.trim() ? r.coverImageUrl : undefined;
  const rawImages = (r.images && typeof r.images === "object" ? r.images : {}) as Record<string, unknown>;
  const images: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawImages)) {
    if (typeof v === "string" && v.trim()) images[k] = v;
  }
  return {
    theme: {
      blue: isHex(t.blue) ? t.blue : DEFAULT_DECK.theme.blue,
      lime: isHex(t.lime) ? t.lime : DEFAULT_DECK.theme.lime,
      dark: isHex(t.dark) ? t.dark : DEFAULT_DECK.theme.dark,
    },
    contact: str(r.contact, DEFAULT_DECK.contact),
    coverImageUrl: cover,
    images,
    vars: rawVars
      .slice(0, 40)
      .map((v) => {
        const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
        return { key: String(o.key ?? "").slice(0, 60), value: String(o.value ?? "").slice(0, 300) };
      })
      .filter((v) => v.key.trim()),
    metodo: {
      items: DEFAULT_DECK.metodo.items.map((d, i) => str(rawItems[i], d)),
      highlightTitle: str(m.highlightTitle, DEFAULT_DECK.metodo.highlightTitle),
      highlightText: str(m.highlightText, DEFAULT_DECK.metodo.highlightText),
      flow: DEFAULT_DECK.metodo.flow.map((d, i) => str(rawFlow[i], d)),
    },
    guia: {
      cells: DEFAULT_DECK.guia.cells.map((d, i) => {
        const c = (rawCells[i] && typeof rawCells[i] === "object" ? rawCells[i] : {}) as Record<string, unknown>;
        return { t: str(c.t, d.t), d: str(c.d, d.d) };
      }),
    },
  };
}

/** Mapa de variáveis (chave minúscula → valor): autos do cliente + custom (custom ganha). */
export function buildVarMap(auto: Record<string, string>, vars: DeckVar[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(auto)) {
    const key = k.trim().toLowerCase();
    if (key && v) map[key] = v;
  }
  for (const v of vars) {
    const key = v.key.trim().toLowerCase();
    if (key) map[key] = v.value ?? "";
  }
  return map;
}

/** Substitui {{chave}} e [chave] pelo valor (chaves conhecidas); mantém as desconhecidas. */
export function applyVars(text: string | undefined, map: Record<string, string>): string {
  if (!text) return text ?? "";
  return text
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (mm, k: string) => (k.toLowerCase() in map ? map[k.toLowerCase()] : mm))
    .replace(/\[\s*([^\]]+?)\s*\]/g, (mm, k: string) => (k.toLowerCase() in map ? map[k.toLowerCase()] : mm));
}
