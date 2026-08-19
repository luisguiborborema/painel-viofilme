import { PageHeader } from "@/components/dashboard/page-header";
import { getClients, getCrmLeads } from "@/lib/data/queries";
import { getDiagnostics } from "@/lib/data/diagnostic-server";
import { DiagnosticList } from "@/components/gerencial/diagnostic-list";

export default async function GerencialDiagnostico() {
  const [diagnostics, clients, leads] = await Promise.all([getDiagnostics(), getClients(), getCrmLeads()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Diagnóstico"
        subtitle="Roteiro de diagnóstico (comercial e entregas): o time preenche na reunião e gera um documento para o cliente."
      />
      <DiagnosticList
        diagnostics={diagnostics}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        leads={leads.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
