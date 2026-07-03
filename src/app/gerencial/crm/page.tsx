import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { getCrmDashboard, getCrmLeads, crmNowIso } from "@/lib/data/queries";
import { toCard, CRM_AGENDA } from "@/lib/data/crm";
import { listUpcomingEvents } from "@/lib/google/calendar";

const TZ = "America/Sao_Paulo";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [dashboard, leads, events] = await Promise.all([
    getCrmDashboard(),
    getCrmLeads(),
    listUpcomingEvents(6),
  ]);
  const nowIso = crmNowIso();
  const cards = leads.map((l) => toCard(l, nowIso));

  // Agenda de hoje: eventos reais do Google (fallback para mock).
  const fmtTime = (iso?: string) =>
    iso
      ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso))
      : "—";
  const agenda = events.length
    ? events.map((e) => ({ time: fmtTime(e.start), title: e.summary, meetLink: e.hangoutLink }))
    : CRM_AGENDA.map((a) => ({ time: a.time, title: a.title, meetLink: undefined as string | undefined }));

  const tabs: ClientTab[] = [
    { key: "dashboard", label: "Dashboard", content: <CrmDashboard d={dashboard} agenda={agenda} /> },
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
