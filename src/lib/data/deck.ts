/**
 * Textos editáveis da apresentação da Linha Editorial (slides "Método Viofilme"
 * e "Guia de produção"). Guardados por cliente em clients.deck_config (jsonb);
 * caem nos defaults do template quando não personalizados. Só o TEXTO é editável
 * — cores/layout dos slides são fixos.
 */
export type DeckCell = { t: string; d: string };

export type DeckConfig = {
  metodo: {
    items: string[]; // 5 rótulos do checklist (01..05)
    highlightTitle: string;
    highlightText: string;
    flow: string[]; // 4 etapas do fluxo
  };
  guia: {
    cells: DeckCell[]; // 6 células (última = regra-chave)
  };
};

export const DEFAULT_DECK: DeckConfig = {
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

/** Mescla o jsonb salvo (parcial/qualquer) com os defaults, com tamanhos fixos. */
export function mergeDeck(raw: unknown): DeckConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const m = (r.metodo && typeof r.metodo === "object" ? r.metodo : {}) as Record<string, unknown>;
  const g = (r.guia && typeof r.guia === "object" ? r.guia : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(m.items) ? m.items : [];
  const rawFlow = Array.isArray(m.flow) ? m.flow : [];
  const rawCells = Array.isArray(g.cells) ? g.cells : [];
  return {
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
