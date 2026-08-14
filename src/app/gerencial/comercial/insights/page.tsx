import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmAnalytics } from "@/components/crm/crm-analytics";
import { CrmGoals } from "@/components/crm/crm-goals";
import { ReportsBuilder } from "@/components/crm/reports-builder";
import { getCrmLeads, getCrmPipelines, getCrmGoals, getStageHistory, getAttendants, getCrmReports, getCrmDashboards, crmNowIso } from "@/lib/data/queries";
import { buildForecast, buildStageTimings, monthKey } from "@/lib/data/crm";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";

export default async function InsightsPage() {
  const nowIso = crmNowIso();
  const curMonth = monthKey(nowIso);
  const [leads, pipelines, history, team, user, goals, reports] = await Promise.all([
    getCrmLeads(),
    getCrmPipelines(),
    getStageHistory(),
    getAttendants(),
    getSession(),
    getCrmGoals(curMonth),
    getCrmReports(),
  ]);
  const dashboards = await getCrmDashboards();
  const teamNames = team.map((t) => t.name);
  const timings = buildStageTimings(history, nowIso);
  const forecast = buildForecast(leads, goals, teamNames, curMonth);
  const canEditGoals = hasFullAccess(user?.allowedSections ?? null);
  const monthLabel = new Date(nowIso).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  const tabs: ClientTab[] = [
    {
      key: "analise",
      label: "Análise",
      content: <CrmAnalytics leads={leads} pipelines={pipelines} nowIso={nowIso} timings={timings} />,
    },
    {
      key: "metas",
      label: "Metas",
      content: <CrmGoals forecast={forecast} monthLabel={monthLabel} canEdit={canEditGoals} goals={goals} />,
    },
    {
      key: "relatorios",
      label: "Relatórios",
      content: <ReportsBuilder initialReports={reports} initialDashboards={dashboards} leads={leads} />,
    },
  ];

  return (
    <div>
      <PageHeader title="Insights" subtitle="Análise do funil e metas do time." />
      <div data-tour="insights-tabs">
        <ClientTabs tabs={tabs} />
      </div>
    </div>
  );
}
