import { notFound } from "next/navigation";
import { ClientHeaderCard } from "@/components/gerencial/client-header-card";
import { ClientNav } from "@/components/gerencial/client-nav";
import {
  getClientDetailCached,
  getClientOpsCached,
  getClientPortalCached,
} from "@/lib/data/client-detail";

export default async function ClienteLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();

  const [ops, portal] = await Promise.all([
    getClientOpsCached(id),
    getClientPortalCached(id),
  ]);

  return (
    <div className="space-y-4">
      <ClientNav
        header={<ClientHeaderCard id={id} d={d} ops={ops} portal={portal} />}
      />
      {children}
    </div>
  );
}
