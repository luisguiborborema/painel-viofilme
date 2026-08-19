import { ListChecks } from "lucide-react";
import { getDeliveryTasks, getClients, getAttendants, getDeliveryConfig } from "@/lib/data/queries";
import { getSession } from "@/lib/auth/session";
import { DeliveryPanel } from "@/components/gerencial/delivery-panel";

export const metadata = { title: "Painel de entregas" };


export default async function GerencialEntregas() {
  const [tasks, clients, team, user, config] = await Promise.all([
    getDeliveryTasks(),
    getClients(),
    getAttendants(),
    getSession(),
    getDeliveryConfig(),
  ]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const teamNames = team.map((t) => t.name);

  return (
    <div className="space-y-4">
      <div data-tour="page-header" className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <ListChecks className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Painel de Entregas
          </h1>
          <p className="text-sm text-muted">
            A cozinha — o que sai hoje, quem está sobrecarregado e onde trava.
          </p>
        </div>
      </div>

      <DeliveryPanel
        tasks={tasks}
        meName={user?.name}
        clients={clientOpts}
        team={teamNames}
        config={config}
      />
    </div>
  );
}
