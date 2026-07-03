import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/crm/lead-detail";
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
  getDealHistory,
} from "@/lib/data/queries";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCrmLead(id);
  if (!data) notFound();
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
  const [flows, dealHistory] = await Promise.all([
    getCrmTaskFlows(),
    getDealHistory(id),
  ]);

  // Contatos ASSOCIADOS ao negócio (via deal_contacts + o primário).
  const assocIds = new Set<string>();
  for (const dc of dealContactRels) if (dc.dealId === lead.id) assocIds.add(dc.contactId);
  if (lead.primaryContactId) assocIds.add(lead.primaryContactId);
  const dealContacts = allContacts.filter((c) => assocIds.has(c.id));

  return (
    <LeadDetail
      lead={lead}
      interactions={data.interactions}
      tasks={data.tasks}
      company={detail?.company ?? null}
      companyContacts={detail?.contacts ?? []}
      dealContacts={dealContacts}
      tags={tags}
      properties={properties}
      team={team.map((t) => t.name)}
      lostReasons={lostReasons.map((r) => r.label)}
      flows={flows}
      history={dealHistory}
    />
  );
}
