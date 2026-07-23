import { InboxClient } from "@/components/inbox/inbox-client";
import { getConversations, getAttendants, getCrmLeads } from "@/lib/data/queries";

export default async function InboxPage() {
  const [conversations, attendants, leads] = await Promise.all([
    getConversations(),
    getAttendants(),
    getCrmLeads(),
  ]);
  // Pick list p/ "vincular a negócio existente" no painel do lead.
  const deals = leads
    .filter((l) => l.stage !== "ganho" && l.stage !== "perdido")
    .map((l) => ({ id: l.id, name: l.name, stage: l.stage }));

  return (
    <div className="-m-4 md:-m-6 lg:-m-8">
      <InboxClient
        initialConversations={conversations}
        attendants={attendants}
        deals={deals}
      />
    </div>
  );
}
