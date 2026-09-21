import { getResultados } from "@/lib/data/resultados-server";
import { ResultadosView } from "@/components/gerencial/resultados";

export const metadata = { title: "Resultados" };
// A página é sempre do período pedido e revalidada a cada ação.


export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // O acesso por seção já é barrado no layout gerencial (§15 da spec).
  const sp = await searchParams;
  const dados = await getResultados({
    gran: sp.gran, periodo: sp.periodo, comp: sp.comp, modo: sp.modo,
  });

  return <ResultadosView dados={dados} aba={sp.aba ?? "dre"} />;
}
