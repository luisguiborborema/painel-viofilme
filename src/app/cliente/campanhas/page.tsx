import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getMediaMetrics, getMediaPerformance } from "@/lib/data/queries";
import { MediaHeader } from "@/components/cliente/media-header";
import { MetricSection } from "@/components/dashboard/metric-chart-panel";
import { BudgetPlatformCard } from "@/components/cliente/budget-platform-card";
import { AdCampaignsTable } from "@/components/cliente/ad-campaigns-table";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { TeamInsight } from "@/components/cliente/team-insight";

export default async function ClienteCampanhas() {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const m = await getMediaPerformance(user.clientId);
  const metrics = await getMediaMetrics(user.clientId);

  return (
    <div className="space-y-4">
      <MediaHeader />

      {/* Carrossel de métricas + gráfico por métrica + orçamento fixo (CAM01–04) */}
      <MetricSection
        metrics={metrics}
        layout="carousel"
        rightColumn={
          <BudgetPlatformCard
            invested={m.invested}
            budget={m.budget}
            pct={m.pct}
            daysRemaining={m.daysRemaining}
            balance={m.balance}
            dailyPace={m.dailyPace}
            metaInvested={m.metaInvested}
            googleInvested={m.googleInvested}
            clientType={m.clientType}
            leadsDelta={m.leadsDelta}
            cplDelta={m.cplDelta}
            convDelta={m.convDelta}
          />
        }
      />

      {/* Tabela de campanhas ativas (CAM06/07) */}
      <Card className="p-5">
        <AdCampaignsTable campaigns={m.campaigns} total={m.campaigns.length} />
      </Card>

      {/* Insights por IA com fallback manual (CAM08) */}
      <AiInsights
        mode="campaigns"
        businessType="gastronomia / restaurante"
        data={{
          invested: m.invested,
          leads: m.leads,
          leadsDelta: m.leadsDelta,
          cpl: m.cpl,
          cplDelta: m.cplDelta,
          conversions: m.conversions,
          cpa: m.cpa,
          campaigns: m.campaigns.map((c) => ({
            name: c.name,
            network: c.network,
            cpl: c.cpl,
            conversions: c.conversions,
            clicks: c.clicks,
          })),
        }}
        fallback={
          <TeamInsight
            title={`Insight da equipe — ${m.periodLabel}`}
            text={m.insight}
          />
        }
      />
    </div>
  );
}
