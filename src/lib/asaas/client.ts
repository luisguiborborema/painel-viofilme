/**
 * Chamadas de saída para a API do Asaas (criar cliente + assinatura recorrente).
 * Requer ASAAS_API_KEY (e ASAAS_ENV) nas variáveis de ambiente.
 */
import { ASAAS_API_BASE, ASAAS_API_KEY } from "./config";

export function isAsaasApiConfigured(): boolean {
  return ASAAS_API_KEY.length > 0;
}

async function asaasFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${ASAAS_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errs = json.errors as { description?: string }[] | undefined;
    throw new Error(errs?.[0]?.description || `Asaas ${res.status}`);
  }
  return json as T;
}

export type AsaasCustomer = { id: string };
export type AsaasSubscription = {
  id: string;
  status?: string;
  value?: number;
  cycle?: string;
  billingType?: string;
  nextDueDate?: string;
};

/** Cria (ou atualiza) um cliente no Asaas. cpfCnpj é obrigatório. */
export function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Cria uma assinatura recorrente para o cliente Asaas. */
export function createSubscription(input: {
  customer: string;
  value: number;
  nextDueDate: string; // AAAA-MM-DD
  cycle: string; // MONTHLY, QUARTERLY, YEARLY
  billingType: string; // PIX, BOLETO, CREDIT_CARD, UNDEFINED
  description?: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Desativa (remove) uma assinatura no Asaas. */
export function deleteSubscription(id: string): Promise<{ deleted?: boolean }> {
  return asaasFetch(`/subscriptions/${id}`, { method: "DELETE" });
}
