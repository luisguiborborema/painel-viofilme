import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import {
  getClientById,
  getOrganicMetrics,
  getOrganicResults,
} from "@/lib/data/queries";
import { OrganicHeader } from "@/components/cliente/organic-header";
import { MetricSection } from "@/components/dashboard/metric-chart-panel";
import {
  FormatCarousel,
  type FormatSlide,
} from "@/components/cliente/format-carousel";
import { NetworkCard } from "@/components/cliente/network-card";
import { AudienceCard } from "@/components/cliente/audience-card";
import { TopPostsCard } from "@/components/cliente/top-posts-card";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { TeamInsight } from "@/components/cliente/team-insight";
import type { FormatReach, Platform } from "@/lib/data/types";

const FORMAT_COLORS: Record<keyof FormatReach, string> = {
  reels: "#ec4899",
  feed: "#38bdf8",
  stories: "#8b5cf6",
  carousel: "#34d399",
};
const FORMAT_NAME: Record<keyof FormatReach, string> = {
  reels: "Reels",
  feed: "Feed",
  stories: "Stories",
  carousel: "Carrossel",
};
const FORMAT_KEYS = ["reels", "feed", "stories", "carousel"] as const;

function slideItems(f: FormatReach) {
  return FORMAT_KEYS.map((k) => ({
    name: FORMAT_NAME[k],
    value: f[k],
    color: FORMAT_COLORS[k],
  }));
}

function leaderName(f: FormatReach) {
  return FORMAT_KEYS.reduce((a, b) => (f[b] > f[a] ? b : a));
}

const NETWORK_ROLE: Record<Platform, string> = {
  instagram: "Principal",
  facebook: "Secundário",
};

export default async function ClienteResultados() {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const [o, metrics, client] = await Promise.all([
    getOrganicResults(user.clientId),
    getOrganicMetrics(user.clientId),
    getClientById(user.clientId),
  ]);

  const businessType = client?.segment ?? "negócio local";
  const activeNetworks = client?.activeNetworks ?? ["instagram", "facebook"];

  const slides: FormatSlide[] = [
    {
      title: "Alcance por formato",
      items: slideItems(o.reachByFormat),
      insight: `${FORMAT_NAME[leaderName(o.reachByFormat)]} lideram o alcance — concentre a distribuição nesse formato.`,
    },
    {
      title: "Engajamento por formato",
      items: slideItems(o.engagementByFormat),
      insight: `${FORMAT_NAME[leaderName(o.engagementByFormat)]} têm o maior engajamento relativo — bom para conversa com a audiência.`,
    },
    {
      title: "Volume publicado por formato",
      items: slideItems(o.volumeByFormat),
      insight: `Publicamos mais ${FORMAT_NAME[leaderName(o.volumeByFormat)]} no período — avalie o equilíbrio com o que mais alcança.`,
    },
  ];

  const handles: Record<Platform, string> = {
    instagram: client?.instagramUsername ?? "instagram",
    facebook: client?.facebookPageName ?? "Facebook",
  };

  return (
    <div className="space-y-4">
      <OrganicHeader />

      {/* ORG01–03 + ORG05: carrossel de métricas → gráfico + carrossel de formatos */}
      <MetricSection
        metrics={metrics}
        layout="carousel"
        defaultKey="seguidores"
        rightColumn={<FormatCarousel slides={slides} />}
      />

      {/* ORG06 + audiência: cards de rede modulares por rede ativa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {activeNetworks.map((n) => {
          const scope = n === "instagram" ? o.instagram : o.facebook;
          return (
            <NetworkCard
              key={n}
              network={n}
              handle={handles[n]}
              role={NETWORK_ROLE[n]}
              scope={{
                followers: scope.followers,
                followersDelta: scope.followersDelta,
                reach: scope.reach,
                impressions: scope.impressions,
                engagement: scope.engagement,
              }}
              reachByFormat={o.reachByFormat}
            />
          );
        })}
        <AudienceCard audience={o.audience} />
      </div>

      {/* Aviso de redes futuras (sem CTA) */}
      <Card className="flex items-start gap-3 p-4">
        <span className="mt-0.5 text-brand-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Em breve</p>
          <p className="text-xs text-muted">
            TikTok, YouTube e LinkedIn poderão ser conectados para ampliar a
            leitura de resultados orgânicos. Avisaremos quando estiver
            disponível.
          </p>
        </div>
      </Card>

      {/* ORG07 + ORG08: top 3 posts expansíveis + análise por IA */}
      <TopPostsCard
        posts={o.topPosts}
        businessType={businessType}
        aiFallback={
          <TeamInsight
            title="Padrão identificado pela equipe"
            text={o.teamPattern}
            tone="emerald"
          />
        }
      />

      {/* ORG10: insights por IA (audiência + formatos), com fallback manual */}
      <AiInsights
        mode="organic"
        title="Insights da IA — orgânico"
        businessType={businessType}
        data={{
          segment: businessType,
          followers: o.totals.followers,
          followersDelta: o.totals.followersDelta,
          reach: o.totals.reach,
          engagement: o.totals.engagement,
          reachByFormat: o.reachByFormat,
          engagementByFormat: o.engagementByFormat,
          topAge: o.audience.ageRanges[0],
          topLocation: o.audience.topLocations[0],
          topPosts: o.topPosts.map((p) => ({
            title: p.title,
            format: p.mediaType,
            reach: p.reach,
          })),
        }}
        fallback={
          <TeamInsight
            title="Padrão identificado pela equipe"
            text={o.teamPattern}
            tone="emerald"
          />
        }
      />
    </div>
  );
}
