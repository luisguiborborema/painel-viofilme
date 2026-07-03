import { PageHeader } from "@/components/dashboard/page-header";
import { getHubClientsOps } from "@/lib/data/operacao";
import { getSession } from "@/lib/auth/session";
import { VioFlux } from "@/components/gerencial/vioflux";

export default async function GerencialConteudo() {
  const ops = getHubClientsOps();
  const user = await getSession();
  const meFirst = user?.name?.split(" ")[0].toLowerCase();

  const clients = ops.map((c) => ({ id: c.id, name: c.name }));
  const myClientIds = meFirst
    ? ops
        .filter((c) => Object.values(c.responsibles).some((n) => n.toLowerCase().includes(meFirst)))
        .map((c) => c.id)
    : [];

  return (
    <div>
      <PageHeader
        title="VioFlux"
        subtitle="O passa-pratos — do conteúdo pronto à aprovação do cliente e às redes."
      />
      <VioFlux clients={clients} myClientIds={myClientIds} />
    </div>
  );
}
