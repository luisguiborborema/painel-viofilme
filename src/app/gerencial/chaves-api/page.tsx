import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { isAdminTier } from "@/lib/access";
import { listarChaves } from "@/lib/data/api-keys-server";
import { ApiKeysManager } from "@/components/gerencial/api-keys-manager";

export const metadata = { title: "Chaves de API" };

export default async function ChavesApiPage() {
  const user = await getSession();
  // Uma chave dá leitura de tudo pelo MCP, sem passar por RLS: mesma alçada de
  // criar usuário.
  if (!isAdminTier(user?.tier)) notFound();

  const { chaves, semMigracao } = await listarChaves();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chaves de API"
        subtitle="Acesso de leitura aos dados do painel pelo MCP — uma chave por pessoa, revogável a qualquer momento."
      />
      <ApiKeysManager chaves={chaves} semMigracao={semMigracao} />
    </div>
  );
}
