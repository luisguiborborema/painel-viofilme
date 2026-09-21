import { getConfiguracoesFinanceiras } from "@/lib/data/configuracoes-financeiras-server";
import { ConfiguracoesFinanceiras } from "@/components/gerencial/configuracoes-financeiras";

export const metadata = { title: "Configurações financeiras" };
// Os parâmetros mudam o comportamento das outras páginas: nada de cache.


export default async function ConfiguracoesFinanceirasPage() {
  // O acesso por seção já é barrado no layout gerencial.
  return <ConfiguracoesFinanceiras dados={await getConfiguracoesFinanceiras()} />;
}
