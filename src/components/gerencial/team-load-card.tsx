import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CLevel } from "@/lib/data/queries";

const ACCENTS = [
  "bg-amber-500/20 text-amber-300",
  "bg-teal-500/20 text-teal-300",
  "bg-pink-500/20 text-pink-300",
  "bg-violet-500/20 text-violet-300",
  "bg-sky-500/20 text-sky-300",
];

export function TeamLoadCard({ team }: { team: CLevel["teamLoad"] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Carga do time esta semana
        </h2>
        <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
          redistribuir
        </button>
      </div>

      <ul className="space-y-3">
        {team.map((m, i) => {
          const over = m.allocated > m.capacity;
          const pct = Math.min(100, (m.allocated / m.capacity) * 100);
          return (
            <li key={m.name} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  ACCENTS[i % ACCENTS.length],
                )}
              >
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name} <span className="text-muted">· {m.area}</span>
                </p>
                <p className="truncate text-xs text-muted">{m.sub}</p>
              </div>
              <div className="w-20 shrink-0 text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    over ? "text-rose-400" : "text-ink",
                  )}
                >
                  {m.allocated}h / {m.capacity}h
                </p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      over ? "bg-rose-400" : "bg-emerald-400",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
