import { Card } from "@/components/ui/card";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/dashboard/platform";
import { Sparkline } from "@/components/dashboard/charts";
import { formatCompact, formatNumber } from "@/lib/utils";
import type { Platform } from "@/lib/data/types";

type Stats = {
  followers: number;
  followersDelta: number;
  followersDeltaPct: number;
  reach: number;
  reachDelta: number;
  engagement: number;
  engagementDelta: number;
};

function StatRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right">
        <span className="text-base font-bold text-ink">{value}</span>
        <span className="ml-2 text-xs font-medium text-emerald-400">
          {delta}
        </span>
      </span>
    </div>
  );
}

export function PlatformStatCard({
  platform,
  role,
  stats,
  spark,
}: {
  platform: Platform;
  role: "Principal" | "Secundário";
  stats: Stats;
  spark: number[];
}) {
  const color = platform === "instagram" ? "#f472b6" : "#60a5fa";
  const sparkData = spark.map((v) => ({ v }));

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <PlatformIcon platform={platform} />
          {PLATFORM_LABEL[platform]}
        </span>
        <span className="rounded-full bg-subtle-strong px-2.5 py-0.5 text-xs font-medium text-muted">
          {role}
        </span>
      </div>

      <div className="space-y-2.5">
        <StatRow
          label="Seguidores"
          value={formatNumber(stats.followers)}
          delta={`+${formatNumber(stats.followersDelta)} · +${stats.followersDeltaPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
        />
        <StatRow
          label="Alcance"
          value={formatCompact(stats.reach)}
          delta={`+${stats.reachDelta}% vs. maio`}
        />
        <StatRow
          label="Engajamento"
          value={`${stats.engagement.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
          delta={`+${stats.engagementDelta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}pp vs. maio`}
        />
      </div>

      <div className="mt-3">
        <Sparkline data={sparkData} color={color} height={40} />
      </div>
    </Card>
  );
}
