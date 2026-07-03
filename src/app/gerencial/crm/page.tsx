import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { getCrmDashboard, getCrmLeads, crmNowIso } from "@/lib/data/queries";
import { toCard } from "@/lib/data/crm";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [dashboard, leads] = await Promise.all([
    getCrmDashboard(),
    getCrmLeads(),
  ]);
  const nowIso = crmNowIso();
  const cards = leads.map((l) => toCard(l, nowIso));

  const tabs: ClientTab[] = [
    { key: "dashboard", label: "Dashboard", content: <CrmDashboard d={dashboard} /> },
    { key: "pipeline", label: "Pipeline", content: <CrmPipeline cards={cards} /> },
  ];

  return (
    <div>
      <PageHeader
        title="CRM & Vendas"
        subtitle="Funil de aquisição, foco do dia e gestão de leads."
      />
      <ClientTabs tabs={tabs} defaultKey={tab} />
    </div>
  );
}
