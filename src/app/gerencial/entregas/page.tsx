import { ListChecks } from "lucide-react";
import { getDeliveryTasks } from "@/lib/data/operacao";
import { DeliveryPanel } from "@/components/gerencial/delivery-panel";

export default function GerencialEntregas() {
  const tasks = getDeliveryTasks();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <ListChecks className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Painel de Entregas
          </h1>
          <p className="text-sm text-muted">
            Execução da equipe — tarefas, prazos e carga de trabalho.
          </p>
        </div>
      </div>

      <DeliveryPanel tasks={tasks} />
    </div>
  );
}
