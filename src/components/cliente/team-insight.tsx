import { Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "emerald";

const TONE: Record<
  Tone,
  { wrap: string; chip: string; title: string }
> = {
  brand: {
    wrap: "border-brand-500/25 bg-brand-500/10",
    chip: "bg-brand-500/20 text-brand-200",
    title: "text-brand-100",
  },
  emerald: {
    wrap: "border-emerald-500/25 bg-emerald-500/10",
    chip: "bg-emerald-500/20 text-emerald-200",
    title: "text-emerald-100",
  },
};

export function TeamInsight({
  title,
  text,
  tone = "brand",
}: {
  title: string;
  text: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  const Icon = tone === "emerald" ? Sparkles : Lightbulb;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
        t.wrap,
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          t.chip,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <p className={cn("text-sm font-semibold", t.title)}>{title}</p>
        <p className="mt-0.5 text-sm text-ink/80">{text}</p>
      </div>
    </div>
  );
}
