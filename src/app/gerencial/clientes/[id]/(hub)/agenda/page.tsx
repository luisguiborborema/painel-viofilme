import { notFound } from "next/navigation";
import { AgendaTab } from "@/components/gerencial/agenda-tab";
import { getClientDetailCached } from "@/lib/data/client-detail";

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();
  const interactions = d.timeline.filter(
    (ev) => ev.kind === "meeting" || ev.kind === "nps",
  );
  return (
    <AgendaTab
      clientId={id}
      clientName={d.client.name}
      defaultAttendee={d.email}
      meetings={d.agendaMeetings}
      requests={d.agendaRequests}
      interactions={interactions}
    />
  );
}
