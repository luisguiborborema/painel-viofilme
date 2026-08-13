import { PageHeader } from "@/components/dashboard/page-header";
import { CrmListas } from "@/components/crm/crm-listas";
import { getCrmLeads, getCrmTasks, getCrmCompanies, getCrmContacts, getCrmTags, getAttendants, getCrmPipelines, crmNowIso } from "@/lib/data/queries";
import { buildTaskItems, toCard } from "@/lib/data/crm";
import { getSavedViews, getServiceCatalog, getKnowledge } from "@/lib/data/listas-server";
import { getSession } from "@/lib/auth/session";

export default async function ListasPage() {
  const [leads, crmTasks, companies, contacts, tags, team, pipelines, user] = await Promise.all([
    getCrmLeads(),
    getCrmTasks(),
    getCrmCompanies(),
    getCrmContacts(),
    getCrmTags(),
    getAttendants(),
    getCrmPipelines(),
    getSession(),
  ]);
  const [savedViews, serviceCatalog, knowledge] = await Promise.all([
    getSavedViews(user?.id ?? ""),
    getServiceCatalog(),
    getKnowledge(),
  ]);
  const taskItems = buildTaskItems(crmTasks, leads);
  const nowIso = crmNowIso();
  const dealCards = leads.map((l) => toCard(l, nowIso));

  return (
    <div>
      <PageHeader title="Listas" subtitle="Banco de dados comercial — Pessoas, Empresas, Produtos e Processos." />
      <CrmListas
        contacts={contacts}
        companies={companies}
        deals={leads}
        dealCards={dealCards}
        pipelines={pipelines}
        tasks={taskItems}
        tags={tags}
        team={team.map((t) => t.name)}
        teamMembers={team}
        currentUser={user?.name ?? ""}
        savedViews={savedViews}
        serviceCatalog={serviceCatalog}
        knowledge={knowledge}
      />
    </div>
  );
}
