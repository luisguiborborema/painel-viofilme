import { Eye, TrendingUp, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendAreaChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "@/components/dashboard/platform";
import { getSession } from "@/lib/auth/session";
import { getAccountSeries } from "@/lib/data/queries";
import { formatCompact } from "@/lib/utils";
import type { Platform } from "@/lib/data/types";

async function PlatformResults({
  clientId,
  platform,
  color,
}: {
  clientId: string;
  platform: Platform;
  color: string;
}) {
  const series = await getAccountSeries(clientId, platform);
  const followers = series.at(-1)?.followers ?? 0;
  const reach = series.reduce((s, p) => s + p.reach, 0);
  const impressions = series.reduce((s, p) => s + p.impressions, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 capitalize">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{ background: color }}
          >
            <PlatformIcon platform={platform} />
          </span>
          {platform}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-ink">
              {formatCompact(followers)}
            </p>
            <p className="text-xs text-muted">Seguidores</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink">{formatCompact(reach)}</p>
            <p className="text-xs text-muted">Alcance 30d</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink">
              {formatCompact(impressions)}
            </p>
            <p className="text-xs text-muted">Impressões</p>
          </div>
        </div>
        <TrendAreaChart
          data={series}
          dataKey="followers"
          color={color}
          theme="dark"
        />
      </CardContent>
    </Card>
  );
}

export default async function ClienteResultados() {
  const user = await getSession();
  if (!user?.clientId) {
    return <Card className="p-10 text-center text-sm text-muted">Sem cliente vinculado.</Card>;
  }
  const clientId = user.clientId;

  const ig = await getAccountSeries(clientId, "instagram");
  const fb = await getAccountSeries(clientId, "facebook");
  const totalFollowers =
    (ig.at(-1)?.followers ?? 0) + (fb.at(-1)?.followers ?? 0);
  const totalReach =
    ig.reduce((s, p) => s + p.reach, 0) + fb.reduce((s, p) => s + p.reach, 0);
  const totalImpressions =
    ig.reduce((s, p) => s + p.impressions, 0) +
    fb.reduce((s, p) => s + p.impressions, 0);

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle="Crescimento e desempenho das suas redes nos últimos 30 dias."
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Seguidores totais"
          value={formatCompact(totalFollowers)}
          icon={UserPlus}
        />
        <StatCard
          label="Alcance total (30d)"
          value={formatCompact(totalReach)}
          icon={TrendingUp}
        />
        <StatCard
          label="Impressões (30d)"
          value={formatCompact(totalImpressions)}
          icon={Eye}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlatformResults
          clientId={clientId}
          platform="instagram"
          color="#2a63c9"
        />
        <PlatformResults
          clientId={clientId}
          platform="facebook"
          color="#4d7ddb"
        />
      </div>
    </div>
  );
}
