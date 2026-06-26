import { getCLevel } from "@/lib/data/queries";
import { CLevelHeader } from "@/components/gerencial/clevel-header";
import { KpiCard } from "@/components/gerencial/kpi-card";
import { CLevelAlertBanner } from "@/components/gerencial/clevel-alert";
import { MrrChartCard } from "@/components/gerencial/mrr-chart-card";
import { ScaleGoalCard } from "@/components/gerencial/scale-goal-card";
import { AccountsHealthCard } from "@/components/gerencial/accounts-health-card";
import { TeamLoadCard } from "@/components/gerencial/team-load-card";
import { DreCard } from "@/components/gerencial/dre-card";
import { FunnelCard } from "@/components/gerencial/funnel-card";

export default async function GerencialDashboard() {
  const c = await getCLevel();

  return (
    <div className="space-y-4">
      <CLevelHeader subtitle={c.periodLabel} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {c.kpis.map((kpi) => (
          <KpiCard key={kpi.iconKey} kpi={kpi} />
        ))}
      </div>

      {/* Alertas críticos */}
      <div className="space-y-2">
        {c.alerts.map((alert) => (
          <CLevelAlertBanner key={alert.id} alert={alert} />
        ))}
      </div>

      {/* MRR + meta de escala */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MrrChartCard data={c.mrrHistory} />
        </div>
        <ScaleGoalCard goal={c.scaleGoal} />
      </div>

      {/* Resumos operacionais */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AccountsHealthCard accounts={c.accountsHealth} />
        <TeamLoadCard team={c.teamLoad} />
        <DreCard dre={c.dre} />
      </div>

      {/* Funil comercial */}
      <FunnelCard pipeline={c.pipeline} />
    </div>
  );
}
