// Tons de chip/badge — fonte única (antes cada componente definia o seu).
// Fundo pastel + texto escuro; funciona em claro/escuro via tokens do Tailwind.
export type Tone = "muted" | "brand" | "amber" | "emerald" | "red" | "sky" | "violet";

export const TONE_CLASS: Record<Tone, string> = {
  muted: "bg-subtle text-muted",
  brand: "bg-brand-100 text-brand-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
};

/** Classe do chip para um tom (com fallback em muted). */
export function toneClass(tone?: string): string {
  return TONE_CLASS[(tone as Tone) ?? "muted"] ?? TONE_CLASS.muted;
}
