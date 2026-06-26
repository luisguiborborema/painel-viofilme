import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "gold" | "green" | "neutral";

const WRAP: Record<Accent, string> = {
  gold: "border-amber-500/40 bg-amber-500/[0.06]",
  green: "border-emerald-500/40 bg-emerald-500/[0.06]",
  neutral: "border-line",
};

const BTN: Record<Accent, string> = {
  gold: "bg-amber-500 text-amber-950 hover:bg-amber-400",
  green:
    "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
  neutral: "border border-line bg-white/5 text-ink hover:bg-white/10",
};

const LABEL_COLOR: Record<Accent, string> = {
  gold: "text-amber-300",
  green: "text-emerald-300",
  neutral: "text-muted",
};

export function FinanceStatusCard({
  accent,
  label,
  value,
  sub,
  actionLabel,
  actionIcon: ActionIcon,
}: {
  accent: Accent;
  label: string;
  value: string;
  sub: string;
  actionLabel: string;
  actionIcon: LucideIcon;
}) {
  return (
    <div className={cn("rounded-2xl border p-5", WRAP[accent])}>
      <p className={cn("text-xs font-medium", LABEL_COLOR[accent])}>{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
      <button
        className={cn(
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
          BTN[accent],
        )}
      >
        <ActionIcon className="h-4 w-4" /> {actionLabel}
      </button>
    </div>
  );
}
