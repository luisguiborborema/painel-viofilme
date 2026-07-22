import {
  getCrmLead,
  getCrmCompany,
  getCrmContacts,
  getCrmDealContacts,
  getCrmTags,
  getCrmProperties,
  getAttendants,
  getCrmLostReasons,
  getCrmTaskFlows,
  getCrmScripts,
  getCrmDocuments,
  getDealHistory,
  getCrmPipelines,
  getCrmComments,
  getCardLayout,
} from "@/lib/data/queries";
import { getSession } from "@/lib/auth/session";

/**
 * Carrega o negócio + todos os relacionamentos para o detalhe do CRM.
 * Reutilizado pela página cheia (/gerencial/crm/[id]) e pelo modal
 * interceptado (@modal/(.)[id]). Retorna null quando o negócio não existe.
 */
export async function getLeadDetailProps(id: string) {
  const data = await getCrmLead(id);
  if (!data) return null;
  const lead = data.lead;

  const [detail, allContacts, dealContactRels, tags, properties, team, lostReasons] =
    await Promise.all([
      lead.companyId ? getCrmCompany(lead.companyId) : Promise.resolve(null),
      getCrmContacts(),
      getCrmDealContacts(),
      getCrmTags(),
      getCrmProperties(),
      getAttendants(),
      getCrmLostReasons(),
    ]);
  const [flows, dealHistory, pipelines, comments, session, cardFields, scripts, documents] = await Promise.all([
    getCrmTaskFlows(),
    getDealHistory(id),
    getCrmPipelines(),
    getCrmComments(id),
    getSession(),
    getCardLayout("deal"),
    getCrmScripts(),
    getCrmDocuments({ dealId: id }),
  ]);

  // Contatos ASSOCIADOS ao negócio (via deal_contacts + o primário).
  const assocIds = new Set<string>();
  for (const dc of dealContactRels) if (dc.dealId === lead.id) assocIds.add(dc.contactId);
  if (lead.primaryContactId) assocIds.add(lead.primaryContactId);
  const dealContacts = allContacts.filter((c) => assocIds.has(c.id));

  return {
    lead,
    interactions: data.interactions,
    tasks: data.tasks,
    company: detail?.company ?? null,
    companyContacts: detail?.contacts ?? [],
    dealContacts,
    tags,
    properties,
    team: team.map((t) => t.name),
    teamMembers: team,
    lostReasons: lostReasons.map((r) => r.label),
    flows,
    history: dealHistory,
    pipelines,
    comments,
    currentUser: session?.name ?? "",
    cardFields,
    scripts,
    documents,
  };
}
