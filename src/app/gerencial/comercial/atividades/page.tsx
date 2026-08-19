import { PageHeader } from "@/components/dashboard/page-header";
import { CrmActivities } from "@/components/crm/crm-activities";
import { getCrmLeads, getCrmTasks, getCrmPipelines, getCrmScripts, getAttendants } from "@/lib/data/queries";
import { buildTaskItems } from "@/lib/data/crm";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Atividades" };


export default async function AtividadesPage() {
  const [leads, crmTasks, pipelines, scripts, team, user] = await Promise.all([
    getCrmLeads(),
    getCrmTasks(),
    getCrmPipelines(),
    getCrmScripts(),
    getAttendants(),
    getSession(),
  ]);
  const taskItems = buildTaskItems(crmTasks, leads);
  const dealPickList = leads.map((l) => ({ id: l.id, name: l.name, owner: l.owner }));

  return (
    <div>
      <PageHeader title="Atividades" subtitle="Tarefas, ligações e follow-ups do time — o que fazer agora." />
      <CrmActivities
        tasks={taskItems}
        deals={dealPickList}
        pipelines={pipelines}
        team={team.map((t) => t.name)}
        currentUser={user?.name ?? ""}
        scripts={scripts}
      />
    </div>
  );
}
