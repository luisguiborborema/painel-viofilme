import { BellRing, Download, Users } from "lucide-react";
import { getCSPortfolio } from "@/lib/data/cs";
import type { CLevelAlert } from "@/lib/data/queries";
import { formatNumber } from "@/lib/utils";
import { MediaMetricCard } from "@/components/cliente/media-metric-card";
import { CLevelAlertBanner } from "@/components/gerencial/clevel-alert";
import { CSClientsTable } from "@/components/gerencial/cs-clients-table";

export default async function GerencialClientes() {
  const p = getCSPortfolio();

  const alert: CLevelAlert = {
    id: "cs-churn",
    kind: "churn",
    title: `${p.churnRisk} contas em risco crítico de churn`,
    detail: p.alertText,
    actionLabel: "Ver contas em risco",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-300">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Gestão de clientes — CS
            </h1>
            <p className="text-sm text-muted">{p.periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <BellRing className="h-4 w-4" /> Configurar alertas
          </button>
        </div>
      </div>

      {/* KPIs de portfólio */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MediaMetricCard
          label="NPS médio das contas"
          value={String(p.npsAvg)}
          hint={`Promotores: ${p.promoters} · Neutros: ${p.neutrals} · Detratores: ${p.detractors}`}
        />
        <MediaMetricCard
          label="Contas em risco de churn"
          value={String(p.churnRisk)}
          deltaText="Score abaixo de 40 · ação urgente"
          tone="bad"
          deltaDirection="down"
        />
        <MediaMetricCard
          label="Renovações nos próximos 60 dias"
          value={String(p.renewals)}
          hint={`R$ ${formatNumber(p.renewalsValue)}/mês em renovação`}
        />
        <MediaMetricCard
          label="Taxa de retenção acumulada"
          value={`${p.retentionRate}%`}
          hint={p.churnNote}
        />
      </div>

      <CLevelAlertBanner alert={alert} />

      <CSClientsTable clients={p.clients} mrrTotal={p.mrrTotal} />
    </div>
  );
}
