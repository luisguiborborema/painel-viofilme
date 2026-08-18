/** Textos da pesquisa de NPS (personalizáveis). Escala 0–10 é fixa (padrão NPS). */
export type NpsConfig = {
  headline: string;
  intro: string;
  commentLabel: string;
  thankYou: string;
};

export const NPS_DEFAULTS: NpsConfig = {
  headline: "De 0 a 10, o quanto você recomendaria a Viofilme para um amigo ou colega?",
  intro: "",
  commentLabel: "Quer deixar um comentário?",
  thankYou: "Sua opinião nos ajuda a melhorar cada vez mais o nosso trabalho. 💚",
};

/** Normaliza uma linha do banco (snake_case) para o config, com defaults. */
export function toNpsConfig(row: {
  headline?: string | null;
  intro?: string | null;
  comment_label?: string | null;
  thank_you?: string | null;
} | null | undefined): NpsConfig {
  return {
    headline: row?.headline?.trim() || NPS_DEFAULTS.headline,
    intro: row?.intro?.trim() || NPS_DEFAULTS.intro,
    commentLabel: row?.comment_label?.trim() || NPS_DEFAULTS.commentLabel,
    thankYou: row?.thank_you?.trim() || NPS_DEFAULTS.thankYou,
  };
}
