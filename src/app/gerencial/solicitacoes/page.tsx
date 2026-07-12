import { PageHeader } from "@/components/dashboard/page-header";
import { RequestsBoard } from "@/components/gerencial/requests-board";
import { getClientRequests } from "@/lib/data/queries";

export default async function SolicitacoesPage() {
  const requests = await getClientRequests();

  return (
    <div>
      <PageHeader
        title="Solicitações do portal"
        subtitle="Pedidos de reunião e conteúdo enviados pelos clientes. Atualize o status conforme trata cada um."
      />
      <RequestsBoard requests={requests} />
    </div>
  );
}
