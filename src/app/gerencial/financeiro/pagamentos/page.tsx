import { getPagamentos } from "@/lib/data/pagamentos-server";
import { PagamentosView } from "@/components/gerencial/pagamentos";

export const metadata = { title: "Pagamentos" };
// A página está sempre no presente e é revalidada após cada ação.
export const dynamic = "force-dynamic";

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // O acesso por seção já é barrado no layout gerencial (§22 da spec).
  const sp = await searchParams;
  const dados = await getPagamentos({
    visao: sp.visao, mes: sp.mes, agrupar: sp.agrupar, chip: sp.chip, q: sp.q,
  });

  return <PagamentosView dados={dados} aba={sp.aba ?? "contas"} />;
}
