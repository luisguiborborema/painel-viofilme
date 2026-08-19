import { PageHeader } from "@/components/dashboard/page-header";
import { getDiagnosticTemplates } from "@/lib/data/diagnostic-server";
import { DiagnosticTemplatesManager } from "@/components/gerencial/diagnostic-templates-manager";

export const metadata = { title: "Modelos de diagnóstico" };


export default async function DiagnosticoModelos() {
  const templates = await getDiagnosticTemplates();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Modelos de diagnóstico"
        subtitle="Roteiros separados (Comercial, Entregas…) com perguntas e campos calculados por fórmula."
      />
      <DiagnosticTemplatesManager templates={templates} />
    </div>
  );
}
