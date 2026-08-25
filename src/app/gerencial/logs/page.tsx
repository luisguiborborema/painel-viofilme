import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { isAdminTier } from "@/lib/access";
import { getApiLogs } from "@/lib/data/api-logs-server";
import { ApiLogs } from "@/components/gerencial/api-logs";

export const metadata = { title: "Logs de API" };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; source?: string; errors?: string }>;
}) {
  const user = await getSession();
  // Aba de Admin: mesmo com sessão gerencial, só admin vê.
  if (!isAdminTier(user?.tier)) notFound();

  const sp = await searchParams;
  const days = [0, 1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const source = (sp.source ?? "").trim();
  const onlyErrors = sp.errors === "1";

  const data = await getApiLogs({ days, source: source || undefined, onlyErrors });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logs de API"
        subtitle="Chamadas aos endpoints externos: captação pública, formulários, pesquisas, webhooks, MCP e rotinas. Inclui erros de servidor de qualquer rota."
      />
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <ApiLogs data={data} days={days} source={source} onlyErrors={onlyErrors} />
      </Suspense>
    </div>
  );
}
