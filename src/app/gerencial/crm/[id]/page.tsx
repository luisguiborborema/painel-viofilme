import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/crm/lead-detail";
import { getLeadDetailProps } from "@/app/gerencial/crm/_lib/lead-props";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const props = await getLeadDetailProps(id);
  if (!props) notFound();

  return <LeadDetail {...props} />;
}
