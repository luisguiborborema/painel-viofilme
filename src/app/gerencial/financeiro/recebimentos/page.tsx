import { getRecebimentos } from "@/lib/data/recebimentos-server";
import { RecebimentosView } from "@/components/gerencial/recebimentos";

export const metadata = { title: "Recebimentos" };
// A página está sempre no presente e é revalidada após cada ação.
export const dynamic = "force-dynamic";

export default async function RecebimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // O acesso por seção já é barrado no layout gerencial (§16 da spec).
  const sp = await searchParams;
  const dados = await getRecebimentos({
    visao: sp.visao, mes: sp.mes, base: sp.base, q: sp.q,
    chip: sp.chip, faixa: sp.faixa, qCliente: sp.qCliente,
  });

  return <RecebimentosView dados={dados} aba={sp.aba ?? "contas"} />;
}
