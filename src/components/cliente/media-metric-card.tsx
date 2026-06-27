import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "good" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-emerald-400",
  bad: "text-rose-400",
  neutral: "text-muted",
};

export function MediaMetricCard({
  label,
  value,
  deltaText,
  tone = "neutral",
  deltaDirection = "up",
  hint,
  info,
  delta,
  invertDelta = false,
}: {
  label: string;
  value: string;
  deltaText?: string;
  tone?: Tone;
  deltaDirection?: "up" | "down";
  hint?: string;
  info?: string;
  /** Variação numérica — quando informada, calcula tom/seta automaticamente. */
  delta?: number;
  /** Para métricas de custo (menor = melhor): maior fica vermelho/seta para cima. */
  invertDelta?: boolean;
}) {
  if (delta !== undefined) {
    const improving = invertDelta ? delta < 0 : delta >= 0;
    tone = improving ? "good" : "bad";
    deltaDirection = delta >= 0 ? "up" : "down";
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-medium">{label}</span>
        {info && <Info className="h-3.5 w-3.5 opacity-60" aria-label={info} />}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {value}
      </div>
      {deltaText ? (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            TONE_CLASS[tone],
          )}
        >
          {deltaDirection === "up" ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {deltaText}
        </div>
      ) : (
        hint && <div className="mt-1 text-xs text-muted">{hint}</div>
      )}
    </Card>
  );
}
