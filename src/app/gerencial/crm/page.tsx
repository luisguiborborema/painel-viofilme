import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { CrmCompanies } from "@/components/crm/crm-companies";
import { CrmContacts } from "@/components/crm/crm-contacts";
import { CrmSettings } from "@/components/crm/crm-settings";
import { CrmAnalytics } from "@/components/crm/crm-analytics";
import { CrmTasks } from "@/components/crm/crm-tasks";
import { CrmGoals } from "@/components/crm/crm-goals";
import {
  getCrmDashboard,
  getCrmLeads,
  getCrmTasks,
  getCrmGoals,
  getCrmCompanies,
  getCrmContacts,
  getCrmTags,
  getCrmProperties,
  getDefaultPipeline,
  getAttendants,
  getCrmTaskFlows,
  getCaptureForms,
  crmNowIso,
} from "@/lib/data/queries";
import {
  toCard,
  buildFunnelAnalytics,
  buildTaskItems,
  buildForecast,
  monthKey,
  CRM_AGENDA,
} from "@/lib/data/crm";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";

const TZ = "America/Sao_Paulo";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [dashboard, leads, companies, contacts, tags, properties, pipeline, team, user, events] =
    await Promise.all([
      getCrmDashboard(),
      getCrmLeads(),
      getCrmCompanies(),
      getCrmContacts(),
      getCrmTags(),
      getCrmProperties(),
      getDefaultPipeline(),
      getAttendants(),
      getSession(),
      listUpcomingEvents(6),
    ]);
  const teamNames = team.map((t) => t.name);
  const currentUser = user?.name ?? "";
  const nowIso = crmNowIso();
  const cards = leads.map((l) => toCard(l, nowIso));
  const funnel = buildFunnelAnalytics(leads, pipeline.stages, nowIso);
  const curMonth = monthKey(nowIso);
  const [crmTasks, flows, goals, captureForms] = await Promise.all([
    getCrmTasks(),
    getCrmTaskFlows(),
    getCrmGoals(curMonth),
    getCaptureForms(),
  ]);
  const taskItems = buildTaskItems(crmTasks, leads);
  const forecast = buildForecast(leads, goals, teamNames, curMonth);
  const canEditGoals = hasFullAccess(user?.allowedSections ?? null);
  const monthLabel = new Date(nowIso).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const dealPickList = leads.map((l) => ({ id: l.id, name: l.name, owner: l.owner }));
  // Badge da aba Tarefas: minhas pendentes vencendo hoje ou atrasadas.
  const nowD = new Date(nowIso);
  const endOfToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1).getTime();
  const myDueCount = taskItems.filter(
    (t) =>
      t.status === "pending" &&
      (t.owner ?? "") === currentUser &&
      t.dueDate &&
      new Date(t.dueDate).getTime() < endOfToday,
  ).length;

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
    {
      key: "pipeline",
      label: "Pipeline",
      content: (
        <CrmPipeline
          cards={cards}
          stages={pipeline.stages}
          tags={tags}
          companies={companies}
          contacts={contacts}
          team={teamNames}
          currentUser={currentUser}
        />
      ),
    },
    {
      key: "tarefas",
      label: "Tarefas",
      badge: myDueCount,
      content: (
        <CrmTasks
          tasks={taskItems}
          deals={dealPickList}
          currentUser={currentUser}
          properties={properties}
          team={teamNames}
        />
      ),
    },
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
      key: "metas",
      label: "Metas",
      content: (
        <CrmGoals forecast={forecast} monthLabel={monthLabel} canEdit={canEditGoals} />
      ),
    },
    {
      key: "analise",
      label: "Análise",
      content: <CrmAnalytics funnel={funnel} />,
    },
    {
      key: "configuracoes",
      label: "Configurações",
      content: (
        <CrmSettings
          properties={properties}
          pipeline={pipeline}
          tags={tags}
          leads={leads}
          companies={companies}
          contacts={contacts}
          flows={flows}
          captureForms={captureForms}
          team={teamNames}
        />
      ),
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
