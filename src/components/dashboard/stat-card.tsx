import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  hint,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Variação percentual (positivo/negativo). */
  change?: number;
  hint?: string;
}) {
  const hasChange = typeof change === "number";
  const positive = (change ?? 0) >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-ink">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {hasChange && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(change!).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}
            %
          </span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </Card>
  );
}
