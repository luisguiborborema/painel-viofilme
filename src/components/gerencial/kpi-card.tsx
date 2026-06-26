import {
  DollarSign,
  Percent,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CLevelKpi } from "@/lib/data/queries";

const ICONS: Record<CLevelKpi["iconKey"], LucideIcon> = {
  mrr: DollarSign,
  clients: Users,
  margin: Percent,
  cac: Target,
};

const DELTA_TONE = {
  good: "text-emerald-400",
  bad: "text-rose-400",
  neutral: "text-muted",
};

export function KpiCard({ kpi }: { kpi: CLevelKpi }) {
  const Icon = ICONS[kpi.iconKey];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{kpi.label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {kpi.value}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-xs font-medium",
          DELTA_TONE[kpi.deltaTone],
        )}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        {kpi.delta}
      </div>
      <div
        className={cn(
          "mt-1 text-xs",
          kpi.noteTone === "danger" ? "text-rose-400" : "text-muted",
        )}
      >
        {kpi.note}
      </div>
    </Card>
  );
}
