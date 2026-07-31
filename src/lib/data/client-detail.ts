// Helpers de dados compartilhados pelas rotas do Hub de Clientes (tela do
// cliente). `cache()` deduplica as queries pesadas dentro de uma mesma
// renderização (layout + página da aba compartilham o mesmo resultado).
import { cache } from "react";
import {
  getCSClientDetail,
  getHubClientsOps,
  getClientById,
  getClientTasks,
} from "@/lib/data/queries";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess, canAccessSection } from "@/lib/access";
import type { Platform } from "@/lib/data/types";

export type ClientDetail = NonNullable<
  Awaited<ReturnType<typeof getCSClientDetail>>
>;
export type ClientPortal = Awaited<ReturnType<typeof getClientById>>;
export type ClientOps =
  | Awaited<ReturnType<typeof getHubClientsOps>>[number]
  | undefined;

export const getClientDetailCached = cache((id: string) => getCSClientDetail(id));
export const getClientPortalCached = cache((id: string) => getClientById(id));
export const getClientTasksCached = cache((name: string) => getClientTasks(name));
export const getClientOpsCached = cache(async (id: string) => {
  const hub = await getHubClientsOps();
  return hub.find((x) => x.id === id);
});

export function buildClientConfig(portal: ClientPortal, d: ClientDetail) {
  return {
    hasPaidTraffic: portal?.hasPaidTraffic ?? d.campaignsInvested > 0,
    clientType: portal?.clientType ?? ("local_business" as const),
    activeNetworks:
      portal?.activeNetworks ?? (["instagram", "facebook"] as Platform[]),
    asaasCustomerId: portal?.asaasCustomerId ?? "",
    whatsapp: portal?.whatsapp ?? "",
  };
}

/**
 * Perfil operacional (Designer/Editor/Social): sem acesso a Financeiro nem
 * Comercial → esconde a aba Metas (dados comerciais/financeiros do cliente).
 */
export const getClientOpOnly = cache(async () => {
  const s = await getSession();
  return (
    !!s &&
    !hasFullAccess(s.allowedSections) &&
    !canAccessSection(s.allowedSections, "financeiro") &&
    !canAccessSection(s.allowedSections, "crm")
  );
});
