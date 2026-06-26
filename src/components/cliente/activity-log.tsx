import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityItem, ActivityKind } from "@/lib/data/types";

const DOT: Record<ActivityKind, string> = {
  approve: "bg-emerald-400",
  send: "bg-sky-400",
  adjust: "bg-amber-400",
  update: "bg-violet-400",
  payment: "bg-emerald-400",
  login: "bg-zinc-500",
};

export function ActivityLog({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-brand-300" />
        <h2 className="text-sm font-semibold text-ink">
          Atividades recentes nesta conta
        </h2>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                DOT[item.kind],
              )}
            />
            <p className="flex-1 text-sm text-ink/90">{item.text}</p>
            <span className="shrink-0 text-xs text-muted">{item.when}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
