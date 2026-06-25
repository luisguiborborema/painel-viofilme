import { Lightbulb } from "lucide-react";

export function TeamInsight({
  text,
  periodLabel,
}: {
  text: string;
  periodLabel: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-500/25 bg-brand-500/10 px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
        <Lightbulb className="h-[18px] w-[18px]" />
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-100">
          Insight da equipe — {periodLabel}
        </p>
        <p className="mt-0.5 text-sm text-ink/80">{text}</p>
      </div>
    </div>
  );
}
