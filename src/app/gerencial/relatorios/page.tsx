import { FileBarChart } from "lucide-react";
import { RelatoriosCentral } from "@/components/gerencial/relatorios-central";
import { ReportsAutomation } from "@/components/gerencial/reports-automation";
import { getClients } from "@/lib/data/queries";

export default async function GerencialRelatorios() {
  const clients = await getClients();
  const opts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <div data-tour="page-header" className="flex items-start gap-2">
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

      <RelatoriosCentral clients={opts} />

      <div className="pt-2">
        <h2 className="mb-1 text-lg font-semibold text-ink">Updates recorrentes &amp; histórico</h2>
        <p className="mb-3 text-sm text-muted">
          Updates automáticos por cliente (WhatsApp) e histórico de envios.
        </p>
        <ReportsAutomation clients={opts} />
      </div>
    </div>
  );
}
