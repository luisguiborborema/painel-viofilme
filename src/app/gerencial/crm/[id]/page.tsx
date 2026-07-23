import { notFound } from "next/navigation";
import { LeadModal } from "@/components/crm/lead-modal";
import { LeadModalContent } from "@/components/crm/lead-modal-content";
import { getLeadDetailProps } from "@/app/gerencial/crm/_lib/lead-props";

/**
 * Página cheia do negócio (refresh / deep-link). Renderiza a MESMA ficha v2 de
 * 3 zonas do modal interceptado — uma só ficha em todo o CRM (task universal).
 * Fechar/Esc/fundo volta ao pipeline (router.back()).
 */
export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const props = await getLeadDetailProps(id);
  if (!props) notFound();

  return (
    <LeadModal>
      <LeadModalContent {...props} />
    </LeadModal>
  );
}
