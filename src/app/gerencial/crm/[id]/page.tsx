import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/crm/lead-detail";
import { getCrmLead } from "@/lib/data/queries";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCrmLead(id);
  if (!data) notFound();

  return (
    <LeadDetail
      lead={data.lead}
      interactions={data.interactions}
      tasks={data.tasks}
    />
  );
}
