import { notFound } from "next/navigation";
import { getDiagnostic, getDiagnosticTemplate } from "@/lib/data/diagnostic-server";
import { DiagnosticEditor } from "@/components/gerencial/diagnostic-editor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiagnostic(id);
  return { title: d?.subject ? `Diagnóstico — ${d.subject}` : "Diagnóstico" };
}

export default async function DiagnosticoEditar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const diagnostic = await getDiagnostic(id);
  if (!diagnostic) notFound();
  const template = await getDiagnosticTemplate(diagnostic.templateId);
  return (
    <div className="space-y-4">
      <DiagnosticEditor diagnostic={diagnostic} template={template} />
    </div>
  );
}
