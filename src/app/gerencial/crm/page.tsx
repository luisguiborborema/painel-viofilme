import { redirect } from "next/navigation";

export const metadata = { title: "CRM" };


/**
 * O módulo Comercial deixou de viver em abas aqui: agora cada área é uma rota
 * de 1º nível sob /gerencial/comercial/*. Esta rota antiga redireciona para o
 * Dashboard. A ficha do negócio segue em /gerencial/crm/[id] (+ modal).
 */
export default function CrmRedirect() {
  redirect("/gerencial/comercial/dashboard");
}
