import { parseQuestions, type NpsExtraAnswer, type NpsQuestion } from "./nps";

/** Textos + perguntas extras da pesquisa pós-reunião. Escala 1–5 estrelas é fixa. */
export type MeetingSurveyConfig = {
  headline: string;
  intro: string;
  commentLabel: string;
  thankYou: string;
  questions: NpsQuestion[];
};

export const MEETING_DEFAULTS: MeetingSurveyConfig = {
  headline: "Como você avalia a reunião com a Viofilme?",
  intro: "",
  commentLabel: "Quer deixar um comentário sobre a reunião?",
  thankYou: "Obrigado! Seu retorno nos ajuda a deixar as reuniões cada vez melhores. 💙",
  questions: [],
};

export function toMeetingConfig(row: {
  headline?: string | null;
  intro?: string | null;
  comment_label?: string | null;
  thank_you?: string | null;
  questions?: unknown;
} | null | undefined): MeetingSurveyConfig {
  return {
    headline: row?.headline?.trim() || MEETING_DEFAULTS.headline,
    intro: row?.intro?.trim() || MEETING_DEFAULTS.intro,
    commentLabel: row?.comment_label?.trim() || MEETING_DEFAULTS.commentLabel,
    thankYou: row?.thank_you?.trim() || MEETING_DEFAULTS.thankYou,
    questions: parseQuestions(row?.questions),
  };
}

/** Uma resposta da pesquisa pós-reunião (visão global). */
export type MeetingEntry = {
  id: string;
  clientId: string;
  clientName: string;
  rating: number; // 1–5
  comment: string;
  extra: NpsExtraAnswer[];
  respondent: string;
  channel: string;
  date: string; // ISO
};

/** Resumo: média das estrelas + contagem por nota. */
export function meetingSummary(entries: { rating: number }[]) {
  const total = entries.length;
  const sum = entries.reduce((s, e) => s + e.rating, 0);
  const avg = total ? Math.round((sum / total) * 10) / 10 : 0;
  const dist = [1, 2, 3, 4, 5].map((star) => ({ star, count: entries.filter((e) => e.rating === star).length }));
  return { total, avg, dist };
}
