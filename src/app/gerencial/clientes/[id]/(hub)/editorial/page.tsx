import { LinhaEditorial } from "@/components/gerencial/linha-editorial";
import {
  getEditorialLineView,
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
  const [data, drafts, deliverables] = await Promise.all([
    getEditorialLineView(id, le),
    getEditorialDrafts(id),
    getClientDeliverables(id),
  ]);
  return (
    <LinhaEditorial data={data} clientId={id} deliverables={deliverables} drafts={drafts} />
  );
}
