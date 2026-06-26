import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CLevelAlert } from "@/lib/data/queries";

const STYLE: Record<
  CLevelAlert["kind"],
  { wrap: string; chip: string; title: string; btn: string; Icon: LucideIcon }
> = {
  churn: {
    wrap: "border-rose-500/30 bg-rose-500/10",
    chip: "bg-rose-500/20 text-rose-300",
    title: "text-rose-100",
    btn: "border-rose-500/40 text-rose-200 hover:bg-rose-500/15",
    Icon: AlertTriangle,
  },
  production: {
    wrap: "border-amber-500/30 bg-amber-500/10",
    chip: "bg-amber-500/20 text-amber-300",
    title: "text-amber-100",
    btn: "border-amber-500/40 text-amber-200 hover:bg-amber-500/15",
    Icon: Users,
  },
  contracts: {
    wrap: "border-yellow-500/30 bg-yellow-500/[0.08]",
    chip: "bg-yellow-500/20 text-yellow-300",
    title: "text-yellow-100",
    btn: "border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/15",
    Icon: CalendarClock,
  },
  pipeline: {
    wrap: "border-sky-500/30 bg-sky-500/10",
    chip: "bg-sky-500/20 text-sky-300",
    title: "text-sky-100",
    btn: "border-sky-500/40 text-sky-200 hover:bg-sky-500/15",
    Icon: TrendingUp,
  },
};

export function CLevelAlertBanner({ alert }: { alert: CLevelAlert }) {
  const s = STYLE[alert.kind];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3",
        s.wrap,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            s.chip,
          )}
        >
          <s.Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className={cn("text-sm font-semibold", s.title)}>{alert.title}</p>
          <p className="mt-0.5 text-xs text-ink/70">{alert.detail}</p>
        </div>
      </div>
      <button
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-transparent px-4 py-2 text-sm font-medium transition-colors",
          s.btn,
        )}
      >
        {alert.actionLabel} <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}
