import { FileBarChart } from "lucide-react";
import { RelatoriosCentral } from "@/components/gerencial/relatorios-central";
import { ReportsAutomation } from "@/components/gerencial/reports-automation";
import { getClients } from "@/lib/data/queries";

export default async function GerencialRelatorios() {
  const clients = await getClients();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <FileBarChart className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Central de relatórios
          </h1>
          <p className="text-sm text-muted">
            Relatórios sob demanda + updates recorrentes automáticos no WhatsApp.
          </p>
        </div>
      </div>

      <RelatoriosCentral />

      <div className="pt-2">
        <h2 className="mb-1 text-lg font-semibold text-ink">Envios &amp; automação</h2>
        <p className="mb-3 text-sm text-muted">
          Envio manual do relatório, updates recorrentes por cliente e histórico de envios.
        </p>
        <ReportsAutomation clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
