import { notFound } from "next/navigation";
import { LeadModal } from "@/components/crm/lead-modal";
import { LeadModalContent } from "@/components/crm/lead-modal-content";
import { getLeadDetailProps } from "@/app/gerencial/crm/_lib/lead-props";

/**
 * Rota INTERCEPTADA: ao clicar num card do board, abre o negócio como modal
 * (layout ClickUp) sobre o pipeline. Refresh/deep-link caem na página cheia.
 */
export default async function InterceptedLeadModal({
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
