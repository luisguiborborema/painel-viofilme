import { notFound } from "next/navigation";
import { getDiagnostic, getDiagnosticTemplate } from "@/lib/data/diagnostic-server";
import { DiagnosticDoc } from "@/components/gerencial/diagnostic-doc";

export default async function DiagnosticoDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const diagnostic = await getDiagnostic(id);
  if (!diagnostic) notFound();
  const template = await getDiagnosticTemplate(diagnostic.templateId);
  return <DiagnosticDoc diagnostic={diagnostic} template={template} />;
}
