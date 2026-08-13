// Tipos client-safe do board de Sugestões de ajustes.

export type SuggestionAttachment = {
  url: string;
  type: "image" | "video" | "file";
  name: string;
};

export type Suggestion = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  status: string;
  attachments: SuggestionAttachment[];
  createdAt: string;
};

export const SUGGESTION_STATUS: { key: string; label: string; tone: string }[] = [
  { key: "aberta", label: "Aberta", tone: "bg-brand-500/15 text-brand-600" },
  { key: "em_analise", label: "Em análise", tone: "bg-amber-500/15 text-amber-600" },
  { key: "planejada", label: "Planejada", tone: "bg-violet-500/15 text-violet-500" },
  { key: "concluida", label: "Concluída", tone: "bg-emerald-500/15 text-emerald-600" },
  { key: "recusada", label: "Recusada", tone: "bg-rose-500/15 text-rose-500" },
];
export const SUGGESTION_STATUS_KEYS = SUGGESTION_STATUS.map((s) => s.key);
