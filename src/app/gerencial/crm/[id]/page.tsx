import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/crm/lead-detail";
import {
  getCrmLead,
  getCrmCompany,
  getCrmTags,
  getCrmProperties,
} from "@/lib/data/queries";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCrmLead(id);
  if (!data) notFound();

  const [detail, tags, properties] = await Promise.all([
    data.lead.companyId ? getCrmCompany(data.lead.companyId) : Promise.resolve(null),
    getCrmTags(),
    getCrmProperties(),
  ]);

  return (
    <LeadDetail
      lead={data.lead}
      interactions={data.interactions}
      tasks={data.tasks}
      company={detail?.company ?? null}
      companyContacts={detail?.contacts ?? []}
      tags={tags}
      properties={properties}
    />
  );
}
