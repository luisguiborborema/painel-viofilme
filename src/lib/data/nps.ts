/** Pergunta extra da pesquisa (além da nota 0–10). */
export type NpsQuestion = {
  id: string;
  label: string;
  type: "text" | "choice";
  options: string[]; // usado quando type === "choice"
};

/** Resposta a uma pergunta extra (gravada junto do NPS). */
export type NpsExtraAnswer = { id: string; label: string; value: string };

/** Textos + perguntas extras da pesquisa de NPS. Escala 0–10 é fixa. */
export type NpsConfig = {
  headline: string;
  intro: string;
  commentLabel: string;
  thankYou: string;
  questions: NpsQuestion[];
};

export const NPS_DEFAULTS: NpsConfig = {
  headline: "De 0 a 10, o quanto você recomendaria a Viofilme para um amigo ou colega?",
  intro: "",
  commentLabel: "Quer deixar um comentário?",
  thankYou: "Sua opinião nos ajuda a melhorar cada vez mais o nosso trabalho. 💚",
  questions: [],
};

/** Sanitiza/valida a lista de perguntas extras (do banco ou do editor). */
export function parseQuestions(raw: unknown): NpsQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q, i): NpsQuestion | null => {
      if (!q || typeof q !== "object") return null;
      const o = q as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      if (!label) return null;
      const type = o.type === "choice" ? "choice" : "text";
      const options =
        type === "choice" && Array.isArray(o.options)
          ? o.options.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
          : [];
      return { id: String(o.id ?? `q${i + 1}`), label, type, options };
    })
    .filter((q): q is NpsQuestion => q !== null)
    .slice(0, 12);
}

/** Normaliza uma linha do banco (snake_case) para o config, com defaults. */
export function toNpsConfig(row: {
  headline?: string | null;
  intro?: string | null;
  comment_label?: string | null;
  thank_you?: string | null;
  questions?: unknown;
} | null | undefined): NpsConfig {
  return {
    headline: row?.headline?.trim() || NPS_DEFAULTS.headline,
    intro: row?.intro?.trim() || NPS_DEFAULTS.intro,
    commentLabel: row?.comment_label?.trim() || NPS_DEFAULTS.commentLabel,
    thankYou: row?.thank_you?.trim() || NPS_DEFAULTS.thankYou,
    questions: parseQuestions(row?.questions),
  };
}

/** Classificação NPS por nota. */
export function npsClass(score: number): "detrator" | "neutro" | "promotor" {
  if (score <= 6) return "detrator";
  if (score <= 8) return "neutro";
  return "promotor";
}

/** Uma resposta de NPS (visão global da gerência). */
export type NpsEntry = {
  id: string;
  clientId: string;
  clientName: string;
  score: number;
  classification: "detrator" | "neutro" | "promotor";
  comment: string;
  extra: NpsExtraAnswer[];
  respondent: string;
  channel: string;
  date: string; // ISO
};

/** Resumo NPS: score (%promotores − %detratores) + contagens. */
export function npsSummary(entries: { score: number }[]) {
  let promoters = 0;
  let detractors = 0;
  let neutros = 0;
  for (const e of entries) {
    const c = npsClass(e.score);
    if (c === "promotor") promoters += 1;
    else if (c === "detrator") detractors += 1;
    else neutros += 1;
  }
  const total = entries.length;
  const score = total ? Math.round(((promoters - detractors) / total) * 100) : 0;
  return { total, promoters, detractors, neutros, score };
}
