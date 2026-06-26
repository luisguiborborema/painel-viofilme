import { Download } from "lucide-react";
import type { Invoice } from "@/lib/data/types";
import { fullDate, daysUntil } from "@/lib/datetime";
import { formatBRL, formatNumber } from "@/lib/utils";

export function InvoicesTable({
  invoices,
  totalPaid,
  year,
  refIso,
}: {
  invoices: Invoice[];
  totalPaid: number;
  year: number;
  refIso: string;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Competência</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const days = daysUntil(refIso, inv.dueDate);
              return (
                <tr
                  key={inv.id}
                  className="border-b border-line last:border-0 hover:bg-subtle"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {inv.competence}
                  </td>
                  <td className="px-4 py-3 text-muted">{inv.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {formatBRL(inv.amount)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {fullDate(inv.dueDate)}
                    {inv.status === "open" && days >= 0 && (
                      <span className="block text-xs text-amber-400">
                        Vence em {days} {days === 1 ? "dia" : "dias"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "open" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        Em aberto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                        Pago{inv.method ? ` · ${inv.method}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === "open" ? (
                      <button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400">
                        PIX
                      </button>
                    ) : (
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle-strong">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          Total pago em {year}:{" "}
          <span className="font-semibold text-ink">
            R$ {formatNumber(totalPaid)}
          </span>
        </span>
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200">
          <Download className="h-3.5 w-3.5" /> Exportar histórico
        </button>
      </div>
    </div>
  );
}
