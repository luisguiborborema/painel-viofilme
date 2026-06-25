import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getOrganicResults } from "@/lib/data/queries";
import { formatCompact, formatNumber } from "@/lib/utils";
import { OrganicHeader } from "@/components/cliente/organic-header";
import { MediaMetricCard } from "@/components/cliente/media-metric-card";
import { FollowersLineCard } from "@/components/cliente/followers-line-card";
import { FormatDonutCard } from "@/components/cliente/format-donut-card";
import { PlatformStatCard } from "@/components/cliente/platform-stat-card";
import { AudienceCard } from "@/components/cliente/audience-card";
import { TopPostsCard } from "@/components/cliente/top-posts-card";
import { TeamInsight } from "@/components/cliente/team-insight";

const pct1 = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function ClienteResultados({
  searchParams,
}: {
  searchParams: Promise<{ rede?: string }>;
}) {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const { rede } = await searchParams;
  const o = await getOrganicResults(user.clientId);

  const platform =
    rede === "instagram" ? "instagram" : rede === "facebook" ? "facebook" : "todas";
  const scope =
    platform === "instagram"
      ? o.instagram
      : platform === "facebook"
        ? o.facebook
        : o.totals;
  const aboveAvg = platform === "todas" && o.totals.engagementAboveAvg;

  return (
    <div className="space-y-4">
      <OrganicHeader periodLabel={o.periodLabel} />

      {/* Métricas de crescimento */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MediaMetricCard
          label={platform === "todas" ? "Seguidores totais" : "Seguidores"}
          value={formatNumber(scope.followers)}
          deltaText={`+${formatNumber(scope.followersDelta)} este mês · +${pct1(scope.followersDeltaPct)}%`}
          tone="good"
          deltaDirection="up"
          info="Seguidores ganhos no período (sem impulsionamento)."
        />
        <MediaMetricCard
          label="Alcance no mês"
          value={formatCompact(scope.reach)}
          deltaText={`+${scope.reachDelta}% vs. maio`}
          tone="good"
          deltaDirection="up"
          info="Contas únicas alcançadas organicamente."
        />
        <MediaMetricCard
          label="Impressões"
          value={formatCompact(scope.impressions)}
          deltaText={`+${scope.impressionsDelta}% vs. maio · ${pct1(scope.frequency)}x por pessoa`}
          tone="good"
          deltaDirection="up"
          info="Total de exibições do conteúdo."
        />
        <MediaMetricCard
          label="Taxa de engajamento"
          value={`${pct1(scope.engagement)}%`}
          deltaText={`+${pct1(scope.engagementDelta)}pp vs. maio${aboveAvg ? " · acima da média" : ""}`}
          tone="good"
          deltaDirection="up"
          info="Interações divididas pelo alcance."
        />
      </div>

      {/* Crescimento de seguidores + Alcance por formato */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FollowersLineCard data={o.followersHistory} />
        </div>
        <div className="lg:col-span-2">
          <FormatDonutCard data={o.reachByFormat} />
        </div>
      </div>

      {/* Plataformas + audiência */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PlatformStatCard
          platform="instagram"
          role="Principal"
          stats={o.instagram}
          spark={o.followersHistory.map((p) => p.instagram)}
        />
        <PlatformStatCard
          platform="facebook"
          role="Secundário"
          stats={o.facebook}
          spark={o.followersHistory.map((p) => p.facebook)}
        />
        <AudienceCard audience={o.audience} />
      </div>

      {/* Top 3 posts */}
      <TopPostsCard posts={o.topPosts} />

      {/* Padrão identificado */}
      <TeamInsight
        title="Padrão identificado pela equipe"
        text={o.teamPattern}
        tone="emerald"
      />
    </div>
  );
}
