import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { CrmCompanies } from "@/components/crm/crm-companies";
import { CrmContacts } from "@/components/crm/crm-contacts";
import { CrmSettings } from "@/components/crm/crm-settings";
import {
  getCrmDashboard,
  getCrmLeads,
  getCrmCompanies,
  getCrmContacts,
  getCrmTags,
  getCrmProperties,
  crmNowIso,
} from "@/lib/data/queries";
import { toCard, CRM_AGENDA } from "@/lib/data/crm";
import { listUpcomingEvents } from "@/lib/google/calendar";

const TZ = "America/Sao_Paulo";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [dashboard, leads, companies, contacts, tags, properties, events] =
    await Promise.all([
      getCrmDashboard(),
      getCrmLeads(),
      getCrmCompanies(),
      getCrmContacts(),
      getCrmTags(),
      getCrmProperties(),
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
    {
      key: "empresas",
      label: "Empresas",
      content: (
        <CrmCompanies companies={companies} contacts={contacts} deals={leads} tags={tags} />
      ),
    },
    {
      key: "contatos",
      label: "Contatos",
      content: <CrmContacts contacts={contacts} companies={companies} tags={tags} />,
    },
    {
      key: "configuracoes",
      label: "Configurações",
      content: <CrmSettings properties={properties} />,
    },
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
