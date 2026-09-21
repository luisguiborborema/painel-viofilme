import { getCaixa } from "@/lib/data/caixa-server";
import { CaixaView } from "@/components/gerencial/caixa";

export const metadata = { title: "Caixa" };
// A página está sempre no presente e é revalidada após cada ação.
export const dynamic = "force-dynamic";

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // O acesso por seção já é barrado no layout gerencial (§17 da spec).
  const sp = await searchParams;
  const dados = await getCaixa({
    conta: sp.conta, hz: sp.hz, vencidos: sp.vencidos,
    q: sp.q, status: sp.status, tipo: sp.tipo,
  });

  return <CaixaView dados={dados} aba={sp.aba ?? "fluxo"} />;
}
