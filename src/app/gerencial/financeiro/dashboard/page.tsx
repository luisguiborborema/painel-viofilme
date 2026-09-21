import { getSession } from "@/lib/auth/session";
import { getDashboardFinanceiro } from "@/lib/data/dashboard-financeiro-server";
import { registrarVisitaDashboard } from "@/lib/data/dashboard-financeiro-visita";
import { DashboardFinanceiroView } from "@/components/gerencial/dashboard-financeiro";

export const metadata = { title: "Dashboard financeiro" };
// Sempre no presente (spec §2): a página não tem filtro de período e recalcula
// a cada abertura. Cache aqui seria um "hoje" de ontem.


export default async function DashboardFinanceiroPage() {
  // O acesso por seção já é barrado no layout gerencial (§14): o CS não chega
  // até aqui. O que falta checar é só o modo somente leitura.
  const user = await getSession();
  const dados = await getDashboardFinanceiro(user?.id ?? null);

  // A visita é gravada DEPOIS da leitura: gravar antes faria a faixa "Desde
  // ontem" medir a janela a partir de agora e nunca mostrar nada.
  await registrarVisitaDashboard(user?.id ?? null);

  return <DashboardFinanceiroView dados={dados} podeAgir={!user?.readOnly} />;
}
