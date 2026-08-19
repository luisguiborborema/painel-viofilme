import { notFound } from "next/navigation";
import { getDiagnostic, getDiagnosticConfig } from "@/lib/data/diagnostic-server";
import { DiagnosticEditor } from "@/components/gerencial/diagnostic-editor";

export default async function DiagnosticoEditar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [diagnostic, config] = await Promise.all([getDiagnostic(id), getDiagnosticConfig()]);
  if (!diagnostic) notFound();
  return (
    <div className="space-y-4">
      <DiagnosticEditor diagnostic={diagnostic} config={config} />
    </div>
  );
}
