import { PageHeader } from "@/components/dashboard/page-header";
import { ClientTabs, type ClientTab } from "@/components/gerencial/client-tabs";
import { getSession } from "@/lib/auth/session";
import { canAccessSection } from "@/lib/access";
import { CampanhasPanel } from "./campanhas-panel";
import { ResultadosPanel } from "./resultados-panel";

export default async function GestaoAVista({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSession();
  const { tab } = await searchParams;
  const allowed = user?.allowedSections;

  const tabs: ClientTab[] = [];
  if (canAccessSection(allowed, "campanhas")) {
    tabs.push({
      key: "campanhas",
      label: "Campanhas",
      content: <CampanhasPanel />,
    });
  }
  if (canAccessSection(allowed, "resultados")) {
    tabs.push({
      key: "resultados",
      label: "Resultados",
      content: <ResultadosPanel />,
    });
  }

  return (
    <div>
      <PageHeader
        title="Gestão à Vista"
        subtitle="Campanhas e resultados consolidados da carteira de clientes."
      />
      <ClientTabs tabs={tabs} defaultKey={tab} />
    </div>
  );
}
