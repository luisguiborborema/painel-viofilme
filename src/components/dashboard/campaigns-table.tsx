import type { Campaign } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatCompact } from "@/lib/utils";
import { PlatformIcon, STATUS_LABEL } from "./platform";

const STATUS_VARIANT: Record<
  Campaign["status"],
  "success" | "warning" | "muted" | "default"
> = {
  active: "success",
  paused: "warning",
  ended: "muted",
  draft: "default",
};

export function CampaignsTable({
  campaigns,
  clientNameById,
}: {
  campaigns: Campaign[];
  clientNameById?: Record<string, string>;
}) {
  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
        Nenhuma campanha cadastrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Campanha</th>
            {clientNameById && <th className="px-4 py-3 font-medium">Cliente</th>}
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Investido</th>
            <th className="px-4 py-3 text-right font-medium">Alcance</th>
            <th className="px-4 py-3 text-right font-medium">Cliques</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">Conversões</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
            return (
              <tr
                key={c.id}
                className="border-b border-line last:border-0 hover:bg-canvas/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <PlatformIcon platform={c.platform} />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-muted">{c.objective}</p>
                    </div>
                  </div>
                </td>
                {clientNameById && (
                  <td className="px-4 py-3 text-muted">
                    {clientNameById[c.clientId] ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatBRL(c.spend)}
                  <span className="block text-xs text-muted">
                    de {formatBRL(c.budget)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCompact(c.reach)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCompact(c.clicks)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {ctr.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                  {formatCompact(c.conversions)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
