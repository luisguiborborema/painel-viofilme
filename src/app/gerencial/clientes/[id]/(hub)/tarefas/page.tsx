import { notFound } from "next/navigation";
import { ClientTasksTab } from "@/components/gerencial/client-tasks-tab";
import { getClientDetailCached, getClientTasksCached } from "@/lib/data/client-detail";

export default async function TarefasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();
  const tasks = await getClientTasksCached(d.client.name);
  return <ClientTasksTab tasks={tasks} clientId={id} clientName={d.client.name} />;
}
