import { LinhaEditorial } from "@/components/gerencial/linha-editorial";
import { EditorialBoard } from "@/components/gerencial/editorial-board";
import {
  getEditorialLineView,
  getEditorialLines,
  getEditorialDrafts,
  getClientDeliverables,
} from "@/lib/data/queries";

export default async function EditorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ le?: string }>;
}) {
  const { id } = await params;
  const { le } = await searchParams;

  // Sem ?le → quadro (kanban) das linhas editoriais. Com ?le → a LE completa.
  if (!le) {
    const [lines, drafts] = await Promise.all([getEditorialLines(id), getEditorialDrafts(id)]);
    return <EditorialBoard clientId={id} lines={lines} drafts={drafts} />;
  }

  const [data, drafts, deliverables] = await Promise.all([
    getEditorialLineView(id, le),
    getEditorialDrafts(id),
    getClientDeliverables(id),
  ]);
  return (
    <LinhaEditorial data={data} clientId={id} deliverables={deliverables} drafts={drafts} />
  );
}
