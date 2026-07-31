import { notFound } from "next/navigation";
import { CriativosTab } from "@/components/gerencial/criativos-tab";
import { getClientDetailCached, getClientTasksCached } from "@/lib/data/client-detail";

export default async function CriativosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();
  const tasks = await getClientTasksCached(d.client.name);
  return (
    <CriativosTab
      clientName={d.client.name}
      clientId={id}
      existing={tasks.filter((t) => t.origin === "Performance")}
    />
  );
}
