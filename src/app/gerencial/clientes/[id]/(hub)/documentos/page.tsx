import { ClientDocumentsTab } from "@/components/gerencial/client-documents-tab";
import { getClientDocumentsView } from "@/lib/data/queries";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initial = await getClientDocumentsView(id);
  return <ClientDocumentsTab clientId={id} initial={initial} />;
}
