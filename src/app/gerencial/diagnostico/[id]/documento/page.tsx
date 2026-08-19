import { notFound } from "next/navigation";
import { getDiagnostic, getDiagnosticConfig } from "@/lib/data/diagnostic-server";
import { DiagnosticDoc } from "@/components/gerencial/diagnostic-doc";

export default async function DiagnosticoDocumento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [diagnostic, config] = await Promise.all([getDiagnostic(id), getDiagnosticConfig()]);
  if (!diagnostic) notFound();
  return <DiagnosticDoc diagnostic={diagnostic} config={config} />;
}
