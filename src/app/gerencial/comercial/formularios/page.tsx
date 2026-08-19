import { PageHeader } from "@/components/dashboard/page-header";
import { CaptureFormsManager } from "@/components/crm/capture-forms-manager";
import { getCaptureForms, getCrmPipelines, getAttendants, getClients } from "@/lib/data/queries";

export default async function FormulariosPage() {
  const [captureForms, pipelines, team, clients] = await Promise.all([
    getCaptureForms(),
    getCrmPipelines(),
    getAttendants(),
    getClients(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Formulários"
        subtitle="Formulários e briefings públicos que criam negócios no funil (e tarefas em Entregas). Compartilhe o link ou incorpore no seu site."
      />
      <CaptureFormsManager
        forms={captureForms}
        team={team.map((t) => t.name)}
        pipelines={pipelines}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
