import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/crm/contact-detail";
import { getCrmContact, getCrmTags, getCrmProperties } from "@/lib/data/queries";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, tags, properties] = await Promise.all([
    getCrmContact(id),
    getCrmTags(),
    getCrmProperties(),
  ]);
  if (!detail) notFound();

  return (
    <ContactDetail
      contact={detail.contact}
      company={detail.company}
      deals={detail.deals}
      tags={tags}
      properties={properties}
    />
  );
}
