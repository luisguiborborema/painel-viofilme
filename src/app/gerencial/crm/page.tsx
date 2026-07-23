import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { CrmListas } from "@/components/crm/crm-listas";
import { CrmDocumentos } from "@/components/crm/crm-documentos";
import { CrmSettings } from "@/components/crm/crm-settings";
import { CrmAnalytics } from "@/components/crm/crm-analytics";
import { CrmActivities } from "@/components/crm/crm-activities";
import { CrmGoals } from "@/components/crm/crm-goals";
import {
  getCommercialDashboard,
  getCommercialBoard,
  getDailyQuote,
  getCrmLeads,
  getCrmTasks,
  getCrmGoals,
  getCrmCompanies,
  getCrmContacts,
  getCrmTags,
  getCrmProperties,
  getCrmPipelines,
  getAttendants,
  getCrmTaskFlows,
  getCrmScripts,
  getCrmDocuments,
  getDocTemplates,
  getSalesMaterials,
  getCrmLostReasons,
  getCrmFreezeReasons,
  getAssignmentConfig,
  getCaptureForms,
  getStageHistory,
  getCardLayout,
  crmNowIso,
} from "@/lib/data/queries";
import {
  toCard,
  buildTaskItems,
  buildForecast,
  buildStageTimings,
  monthKey,
  CRM_AGENDA,
} from "@/lib/data/crm";
import { getSavedViews, getServiceCatalog, getKnowledge } from "@/lib/data/listas-server";
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
  const [leads, companies, contacts, tags, properties, pipelines, team, user, events] =
    await Promise.all([
      getCrmLeads(),
      getCrmCompanies(),
      getCrmContacts(),
      getCrmTags(),
      getCrmProperties(),
      getCrmPipelines(),
      getAttendants(),
      getSession(),
      listUpcomingEvents(6),
    ]);
  const teamNames = team.map((t) => t.name);
  const currentUser = user?.name ?? "";
  const nowIso = crmNowIso();
  const cards = leads.map((l) => toCard(l, nowIso));
  const curMonth = monthKey(nowIso);
  const [crmTasks, flows, scripts, documents, assignment, goals, captureForms, history, cardLayout, commercialDash, board, quote, lostReasons, savedViews, serviceCatalog, knowledge, docTemplates, salesMaterials, freezeReasons] =
    await Promise.all([
      getCrmTasks(),
      getCrmTaskFlows(),
      getCrmScripts(),
      getCrmDocuments(),
      getAssignmentConfig(),
      getCrmGoals(curMonth),
      getCaptureForms(),
      getStageHistory(),
      getCardLayout("deal"),
      getCommercialDashboard(currentUser),
      getCommercialBoard(),
      getDailyQuote(),
      getCrmLostReasons(),
      getSavedViews(user?.id ?? ""),
      getServiceCatalog(),
      getKnowledge(),
      getDocTemplates(),
      getSalesMaterials(),
      getCrmFreezeReasons(),
    ]);
  const proximaReuniao = events.length
    ? { title: events[0].summary, iso: events[0].start, meetLink: events[0].hangoutLink }
    : undefined;
  const canEditMural = hasFullAccess(user?.allowedSections ?? null) || (user?.commercialRole ?? "gestor") === "gestor";
  const stageTimings = buildStageTimings(history, nowIso);
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
    {
      key: "dashboard",
      label: "Dashboard",
      content: (
        <CrmDashboard
          dash={commercialDash}
          agenda={agenda}
          proximaReuniao={proximaReuniao}
          board={board}
          quote={quote}
          currentUser={currentUser}
          commercialRole={user?.commercialRole ?? "gestor"}
          canEditMural={canEditMural}
        />
      ),
    },
    {
      key: "pipeline",
      label: "Pipeline",
      content: (
        <CrmPipeline
          cards={cards}
          pipelines={pipelines}
          tags={tags}
          companies={companies}
          contacts={contacts}
          team={teamNames}
          teamMembers={team}
          currentUser={currentUser}
          lostReasons={lostReasons.map((r) => r.label)}
        />
      ),
    },
    {
      key: "tarefas",
      label: "Atividades",
      badge: myDueCount,
      content: (
        <CrmActivities
          tasks={taskItems}
          deals={dealPickList}
          pipelines={pipelines}
          team={teamNames}
          currentUser={currentUser}
          scripts={scripts}
        />
      ),
    },
    {
      key: "listas",
      label: "Listas",
      content: (
        <CrmListas
          contacts={contacts}
          companies={companies}
          deals={leads}
          tasks={taskItems}
          tags={tags}
          team={teamNames}
          savedViews={savedViews}
          serviceCatalog={serviceCatalog}
          knowledge={knowledge}
        />
      ),
    },
    {
      key: "documentos",
      label: "Documentos",
      content: (
        <CrmDocumentos
          documents={documents}
          templates={docTemplates}
          materials={salesMaterials}
          deals={dealPickList}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          team={teamNames}
        />
      ),
    },
    {
      key: "metas",
      label: "Metas",
      content: (
        <CrmGoals forecast={forecast} monthLabel={monthLabel} canEdit={canEditGoals} goals={goals} />
      ),
    },
    {
      key: "analise",
      label: "Análise",
      content: (
        <CrmAnalytics
          leads={leads}
          pipelines={pipelines}
          nowIso={nowIso}
          timings={stageTimings}
        />
      ),
    },
    {
      key: "configuracoes",
      label: "Configurações",
      content: (
        <CrmSettings
          properties={properties}
          pipelines={pipelines}
          tags={tags}
          leads={leads}
          companies={companies}
          contacts={contacts}
          flows={flows}
          scripts={scripts}
          assignment={assignment}
          captureForms={captureForms}
          team={teamNames}
          cardLayout={cardLayout}
          canEditCardLayout={canEditGoals}
          lostReasons={lostReasons}
          freezeReasons={freezeReasons}
          canEditStructural={canEditGoals}
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
