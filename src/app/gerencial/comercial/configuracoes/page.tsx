import { PageHeader } from "@/components/dashboard/page-header";
import { CrmSettings } from "@/components/crm/crm-settings";
import {
  getCrmLeads,
  getCrmCompanies,
  getCrmContacts,
  getCrmTags,
  getCrmProperties,
  getCrmPropertyGroups,
  getCrmPipelines,
  getAttendants,
  getCrmTaskFlows,
  getCrmScripts,
  getAssignmentConfig,
  getCaptureForms,
  getCardLayout,
  getCrmLostReasons,
  getCrmFreezeReasons,
  getClients,
} from "@/lib/data/queries";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";

export default async function ConfiguracoesComercialPage() {
  const [leads, companies, contacts, tags, properties, pipelines, team, user] = await Promise.all([
    getCrmLeads(),
    getCrmCompanies(),
    getCrmContacts(),
    getCrmTags(),
    getCrmProperties(),
    getCrmPipelines(),
    getAttendants(),
    getSession(),
  ]);
  const [flows, scripts, assignment, captureForms, cardLayout, lostReasons, freezeReasons, clients, propertyGroups] = await Promise.all([
    getCrmTaskFlows(),
    getCrmScripts(),
    getAssignmentConfig(),
    getCaptureForms(),
    getCardLayout("deal"),
    getCrmLostReasons(),
    getCrmFreezeReasons(),
    getClients(),
    getCrmPropertyGroups(),
  ]);
  const canEdit = hasFullAccess(user?.allowedSections ?? null);

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Fonte única de configuração do módulo Comercial." />
      <CrmSettings
        properties={properties}
        propertyGroups={propertyGroups}
        pipelines={pipelines}
        tags={tags}
        leads={leads}
        companies={companies}
        contacts={contacts}
        flows={flows}
        scripts={scripts}
        assignment={assignment}
        captureForms={captureForms}
        team={team.map((t) => t.name)}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        cardLayout={cardLayout}
        canEditCardLayout={canEdit}
        lostReasons={lostReasons}
        freezeReasons={freezeReasons}
        canEditStructural={canEdit}
      />
    </div>
  );
}
