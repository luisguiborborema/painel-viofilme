"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { AdCampaign } from "@/lib/data/types";
import { NetworkBadge } from "./network-badge";
import { MetricsGlossaryModal } from "@/components/dashboard/metric-info";
import { formatBRL, formatNumber, cn } from "@/lib/utils";

function brl0(v: number) {
  return `R$ ${formatNumber(v)}`;
}

/** Verde abaixo da média, vermelho acima, neutro na faixa (custo: menor = melhor). */
function costTone(value: number, avg: number) {
  if (value < avg * 0.95) return "text-emerald-400";
  if (value > avg * 1.05) return "text-rose-400";
  return "text-ink";
}

const FILTERS = [
  { label: "Todas", value: "todas" },
  { label: "Meta", value: "meta" },
  { label: "Google", value: "google" },
];

export function AdCampaignsTable({
  campaigns,
  total,
}: {
  campaigns: AdCampaign[];
  total: number;
}) {
  const [filter, setFilter] = useState("todas");
  const [glossary, setGlossary] = useState(false);

  const avgCpl =
    campaigns.reduce((s, c) => s + c.cpl, 0) / Math.max(1, campaigns.length);
  const avgCpa =
    campaigns.reduce((s, c) => s + c.cpa, 0) / Math.max(1, campaigns.length);

  const rows = useMemo(
    () =>
      filter === "todas"
        ? campaigns
        : campaigns.filter((c) => c.network === filter),
    [campaigns, filter],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Campanhas ativas</h2>
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "bg-brand-500 text-white" : "text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Campanha</th>
              <th className="px-4 py-3 font-medium">Plataforma</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Investido</th>
              <th className="px-4 py-3 text-right font-medium">Cliques</th>
              <th className="px-4 py-3 text-right font-medium">CPC</th>
              <th className="px-4 py-3 text-right font-medium">Leads</th>
              <th className="px-4 py-3 text-right font-medium">CPL</th>
              <th className="px-4 py-3 text-right font-medium">Conv.</th>
              <th className="px-4 py-3 text-right font-medium">CPA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle"
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
                      c.status === "active" ? "text-emerald-300" : "text-amber-300",
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
                <td className="px-4 py-3 text-right tabular-nums text-ink">{brl0(c.invested)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{formatNumber(c.clicks)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{formatBRL(c.cpc)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{formatNumber(c.leads)}</td>
                <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", costTone(c.cpl, avgCpl))}>
                  {formatBRL(c.cpl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{formatNumber(c.conversions)}</td>
                <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", costTone(c.cpa, avgCpa))}>
                  {formatBRL(c.cpa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{total} campanhas · atualizado há 3h via API</span>
        <button
          onClick={() => setGlossary(true)}
          className="inline-flex items-center gap-1 font-medium text-brand-300 hover:text-brand-200"
        >
          Entender os números <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <MetricsGlossaryModal
        open={glossary}
        onClose={() => setGlossary(false)}
        keys={["cpl", "cpc", "cpa", "roas", "conversoes"]}
      />
    </div>
  );
}
