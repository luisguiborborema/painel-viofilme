import { notFound } from "next/navigation";
import { CompanyDetail } from "@/components/crm/company-detail";
import { getCrmCompany, getCrmTags, getCrmProperties } from "@/lib/data/queries";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, tags, properties] = await Promise.all([
    getCrmCompany(id),
    getCrmTags(),
    getCrmProperties(),
  ]);
  if (!detail) notFound();

  return (
    <CompanyDetail
      company={detail.company}
      contacts={detail.contacts}
      deals={detail.deals}
      tags={tags}
      properties={properties}
    />
  );
}
