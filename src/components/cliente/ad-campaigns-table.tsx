import { ArrowUpRight } from "lucide-react";
import type { AdCampaign } from "@/lib/data/types";
import { NetworkBadge } from "./network-badge";
import { formatBRL, formatNumber, cn } from "@/lib/utils";

function brl0(v: number) {
  return `R$ ${formatNumber(v)}`;
}

function cplTone(cpl: number, target: number) {
  if (cpl < target) return "text-emerald-400";
  if (cpl > target * 1.25) return "text-rose-400";
  return "text-ink";
}

export function AdCampaignsTable({
  campaigns,
  cplTarget,
  total,
}: {
  campaigns: AdCampaign[];
  cplTarget: number;
  total: number;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Campanha</th>
              <th className="px-4 py-3 font-medium">Plataforma</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Investido</th>
              <th className="px-4 py-3 text-right font-medium">Cliques</th>
              <th className="px-4 py-3 text-right font-medium">Leads</th>
              <th className="px-4 py-3 text-right font-medium">CPL</th>
              <th className="px-4 py-3 text-right font-medium">Conv.</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="border-b border-line last:border-0 hover:bg-subtle"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.objective} · {c.audience}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <NetworkBadge network={c.network} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium",
                      c.status === "active"
                        ? "text-emerald-300"
                        : "text-amber-300",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        c.status === "active" ? "bg-emerald-400" : "bg-amber-400",
                      )}
                    />
                    {c.status === "active" ? "Ativa" : "Pausada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {brl0(c.invested)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {formatNumber(c.clicks)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatNumber(c.leads)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold tabular-nums",
                    cplTone(c.cpl, cplTarget),
                  )}
                >
                  {formatBRL(c.cpl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatNumber(c.conversions)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{total} campanhas · atualizado há 3h via API</span>
        <button className="inline-flex items-center gap-1 font-medium text-brand-300 hover:text-brand-200">
          Entender os números <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
