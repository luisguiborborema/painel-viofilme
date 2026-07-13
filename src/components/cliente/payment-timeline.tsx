import { Card } from "@/components/ui/card";
import type { Invoice } from "@/lib/data/types";
import { dayMonth, daysUntil } from "@/lib/datetime";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PaymentTimeline({
  invoices,
  year,
  refIso,
}: {
  invoices: Invoice[];
  year: number;
  refIso: string;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">
        Linha do tempo — pagamentos {year}
      </h2>

      <ol className="relative ml-1 space-y-4 border-l border-line pl-5">
        {invoices.map((inv) => {
          const open = inv.status === "open";
          const days = daysUntil(refIso, inv.dueDate);
          const overdue = open && days < 0;
          const absDays = Math.abs(days);
          return (
            <li key={inv.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-surface",
                  overdue ? "bg-rose-400" : open ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{inv.competence}</p>
                <p className="text-sm font-semibold text-ink">
                  {formatBRL(inv.amount)}
                </p>
              </div>
              {open ? (
                <p className={cn("text-xs", overdue ? "text-rose-400" : "text-amber-400")}>
                  {overdue
                    ? `Vencida há ${absDays} ${absDays === 1 ? "dia" : "dias"}`
                    : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`}
                </p>
              ) : (
                <p className="text-xs text-emerald-400">
                  Pago{inv.method ? ` · ${inv.method}` : ""}
                  {inv.paidDate ? (
                    <span className="text-muted"> · {dayMonth(inv.paidDate)}</span>
                  ) : null}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
