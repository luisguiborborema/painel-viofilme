import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "good" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-emerald-400",
  bad: "text-rose-400",
  neutral: "text-muted",
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  deltaText,
  tone = "neutral",
  /** Direção da seta (cima/baixo). Independe do tom (bom/ruim). */
  deltaDirection = "up",
  /** Linha auxiliar simples (sem seta), usada quando não há variação. */
  hint,
  delta,
  invertDelta = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  deltaText?: string;
  tone?: Tone;
  deltaDirection?: "up" | "down";
  hint?: string;
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
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {value}
      </div>
      {deltaText && (
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
      )}
      {!deltaText && hint && (
        <div className="mt-1 text-xs text-muted">{hint}</div>
      )}
    </Card>
  );
}
