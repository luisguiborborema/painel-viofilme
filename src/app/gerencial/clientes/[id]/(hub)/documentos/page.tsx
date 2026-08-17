import { ClientDocumentsTab } from "@/components/gerencial/client-documents-tab";
import { ClientDriveBrowser } from "@/components/gerencial/client-drive-browser";
import { getClientDocumentsView } from "@/lib/data/queries";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initial = await getClientDocumentsView(id);
  return (
    <div className="space-y-6">
      <ClientDriveBrowser clientId={id} />
      <ClientDocumentsTab clientId={id} initial={initial} />
    </div>
  );
}
