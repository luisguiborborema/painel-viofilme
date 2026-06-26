import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CLevel } from "@/lib/data/queries";

function tone(score: number) {
  if (score >= 75) return { bar: "bg-emerald-400", dot: "bg-emerald-400", text: "text-emerald-300" };
  if (score >= 50) return { bar: "bg-amber-400", dot: "bg-amber-400", text: "text-amber-300" };
  return { bar: "bg-rose-400", dot: "bg-rose-400", text: "text-rose-300" };
}

export function AccountsHealthCard({
  accounts,
}: {
  accounts: CLevel["accountsHealth"];
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Saúde das contas</h2>
        <button className="text-xs font-medium text-brand-300 hover:text-brand-200">
          ver todas
        </button>
      </div>

      <ul className="space-y-2.5">
        {accounts.map((a) => {
          const t = tone(a.score);
          return (
            <li key={a.name} className="flex items-center gap-3">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} />
              <span className="w-28 truncate text-sm text-ink">{a.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full", t.bar)}
                  style={{ width: `${a.score}%` }}
                />
              </div>
              <span className={cn("w-6 text-right text-sm font-semibold", t.text)}>
                {a.score}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
