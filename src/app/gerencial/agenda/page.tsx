import { PageHeader } from "@/components/dashboard/page-header";
import { AgendaClient } from "@/components/gerencial/agenda-client";
import { getSession } from "@/lib/auth/session";
import { getGoogleStatus } from "@/lib/google/client";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/config";
import { getCrmLeads, getCrmTasks, getClients } from "@/lib/data/queries";
import { buildTaskItems } from "@/lib/data/crm";
import {
  getRoutineBlocks,
  getRoutineTemplates,
  getSchedulingLinks,
  getCalendarEvents,
} from "@/lib/data/agenda-server";

export const metadata = { title: "Agenda" };


export default async function AgendaPage() {
  const user = await getSession();
  const ownerId = user?.id ?? "";
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60).toISOString();

  const status = await getGoogleStatus();
  const [googleEvents, routineBlocks, templates, links, events, leads, tasks, clients] = await Promise.all([
    status.connected ? listUpcomingEvents(60) : Promise.resolve([]),
    getRoutineBlocks(ownerId),
    getRoutineTemplates(ownerId),
    getSchedulingLinks(ownerId),
    getCalendarEvents(ownerId, from, to),
    getCrmLeads(),
    getCrmTasks(),
    getClients(),
  ]);

  const me = user?.name ?? "";
  const taskItems = buildTaskItems(tasks, leads)
    .filter((t) => {
      if (t.status !== "pending") return false;
      const a = t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : [];
      return a.length ? a.includes(me) : t.owner === me;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      type: t.properties?.type ? String(t.properties.type) : undefined,
      leadId: t.leadId || undefined,
      dealName: t.dealName,
    }));

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Sua gestora de tempo: rotina, reuniões e tarefas num lugar só." />
      <AgendaClient
        routineBlocks={routineBlocks}
        templates={templates}
        schedulingLinks={links}
        events={events}
        googleEvents={googleEvents}
        googleConnected={status.connected}
        googleConfigured={isGoogleConfigured()}
        tasks={taskItems}
        currentUser={me}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
