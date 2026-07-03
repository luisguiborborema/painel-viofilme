import { InboxClient } from "@/components/inbox/inbox-client";
import { getConversations, getAttendants } from "@/lib/data/queries";

export default async function InboxPage() {
  const [conversations, attendants] = await Promise.all([
    getConversations(),
    getAttendants(),
  ]);

  return (
    <div className="-m-4 md:-m-6 lg:-m-8">
      <InboxClient
        initialConversations={conversations}
        attendants={attendants}
      />
    </div>
  );
}
