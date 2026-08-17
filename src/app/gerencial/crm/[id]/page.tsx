import { notFound } from "next/navigation";
import { LeadModalContent } from "@/components/crm/lead-modal-content";
import { getLeadDetailProps } from "@/app/gerencial/crm/_lib/lead-props";

/**
 * Página cheia do negócio (estilo HubSpot): abre como página real dentro do app
 * — não mais como modal sobreposto. Layout de 3 colunas (Sobre · Atividades ·
 * Associações) com as laterais fixas (sticky). "‹ Negócios" volta ao pipeline.
 */
export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const props = await getLeadDetailProps(id);
  if (!props) notFound();

  return <LeadModalContent {...props} mode="page" />;
}
