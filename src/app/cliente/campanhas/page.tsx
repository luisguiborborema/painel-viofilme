import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { getSession } from "@/lib/auth/session";
import { getMediaPerformance } from "@/lib/data/queries";
import { formatBRL, formatNumber } from "@/lib/utils";
import { MediaHeader } from "@/components/cliente/media-header";
import { MediaMetricCard } from "@/components/cliente/media-metric-card";
import { CplBarCard } from "@/components/cliente/cpl-bar-card";
import { BudgetPlatformCard } from "@/components/cliente/budget-platform-card";
import { AdCampaignsTable } from "@/components/cliente/ad-campaigns-table";
import { TeamInsight } from "@/components/cliente/team-insight";

const REDE_TABS = [
  { label: "Todas", value: "todas" },
  { label: "Meta", value: "meta" },
  { label: "Google", value: "google" },
];

const fmt2 = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default async function ClienteCampanhas({
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
  const m = await getMediaPerformance(user.clientId);

  const filtered =
    rede === "meta" || rede === "google"
      ? m.campaigns.filter((c) => c.network === rede)
      : m.campaigns;

  return (
    <div className="space-y-4">
      <MediaHeader periodLabel={m.periodLabel} />

      {/* Visão consolidada */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MediaMetricCard
          label="Investimento total"
          value={`R$ ${formatNumber(m.invested)}`}
          hint={`de R$ ${formatNumber(m.budget)} orçados · ${m.pct}%`}
          info="Soma do investido em Meta Ads e Google Ads no mês."
        />
        <MediaMetricCard
          label="Leads gerados"
          value={formatNumber(m.leads)}
          deltaText={`${m.leadsDelta >= 0 ? "+" : "-"}${Math.abs(m.leadsDelta)}% vs. maio`}
          tone={m.leadsDelta >= 0 ? "good" : "bad"}
          deltaDirection={m.leadsDelta >= 0 ? "up" : "down"}
          info="Contatos/leads atribuídos às campanhas."
        />
        <MediaMetricCard
          label="Custo por lead"
          value={formatBRL(m.cpl)}
          deltaText={`${m.cplDelta >= 0 ? "+" : "-"}R$ ${fmt2(m.cplDelta)} vs. maio (${m.cplDelta > 0 ? "piorou" : "melhorou"})`}
          tone={m.cplDelta > 0 ? "bad" : "good"}
          deltaDirection={m.cplDelta > 0 ? "up" : "down"}
          info="Investimento total dividido pelo número de leads."
        />
        <MediaMetricCard
          label="Conversões reais"
          value={formatNumber(m.conversions)}
          deltaText={`${m.convDelta >= 0 ? "+" : "-"}${Math.abs(m.convDelta)} vs. maio · CPA R$ ${formatNumber(m.cpa)}`}
          tone={m.convDelta >= 0 ? "good" : "bad"}
          deltaDirection={m.convDelta >= 0 ? "up" : "down"}
          info="Conversões confirmadas e custo por aquisição (CPA)."
        />
      </div>

      {/* CPL mês a mês + Orçamento por plataforma */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CplBarCard data={m.cplHistory} />
        </div>
        <div className="lg:col-span-2">
          <BudgetPlatformCard
            invested={m.invested}
            budget={m.budget}
            pct={m.pct}
            daysRemaining={m.daysRemaining}
            balance={m.balance}
            dailyPace={m.dailyPace}
            metaInvested={m.metaInvested}
            googleInvested={m.googleInvested}
          />
        </div>
      </div>

      {/* Tabela de campanhas ativas */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            Campanhas ativas — {m.periodLabel}
          </h2>
          <FilterTabs param="rede" options={REDE_TABS} />
        </div>
        <AdCampaignsTable
          campaigns={filtered}
          cplTarget={m.cpl}
          total={filtered.length}
        />
      </Card>

      <TeamInsight
        title={`Insight da equipe — ${m.periodLabel}`}
        text={m.insight}
      />
    </div>
  );
}
