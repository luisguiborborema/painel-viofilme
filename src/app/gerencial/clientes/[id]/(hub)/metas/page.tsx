import { notFound } from "next/navigation";
import { ClientGoalsCard } from "@/components/gerencial/client-goals-card";
import {
  getClientDetailCached,
  getClientPortalCached,
  buildClientConfig,
  getClientOpOnly,
} from "@/lib/data/client-detail";

export default async function MetasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Perfil operacional (sem Financeiro/Comercial) não vê Metas.
  if (await getClientOpOnly()) notFound();
  const d = await getClientDetailCached(id);
  if (!d) notFound();
  const portal = await getClientPortalCached(id);
  const config = buildClientConfig(portal, d);
  return <ClientGoalsCard clientId={id} clientType={config.clientType} />;
}
