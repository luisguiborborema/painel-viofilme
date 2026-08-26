/**
 * Regras puras do webhook do Asaas.
 *
 * Separadas da rota porque é aqui que o dinheiro entra no sistema: uma chave de
 * idempotência mal formada descarta um pagamento real, e um mapeamento errado
 * grava o valor errado. Ambos falham em silêncio — a resposta continua 200.
 */

export type AsaasPayment = {
  id: string;
  customer?: string;
  status?: string;
  billingType?: string;
  value?: number;
  netValue?: number;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  description?: string;
  invoiceUrl?: string;
  externalReference?: string;
};

export type AsaasWebhook = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
};

/** Eventos que significam "o dinheiro entrou". */
export const EVENTOS_RECEBIDO = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
] as const;

/**
 * Chave de idempotência do evento.
 *
 * O Asaas manda um `id` próprio (`evt_...`) — quando ele vem, é a chave, e
 * ponto. Sem ele, `pagamento:evento` NÃO serve: o mesmo pagamento pode receber
 * vários `PAYMENT_UPDATED` legítimos (valor corrigido, vencimento adiado) e
 * todos depois do primeiro seriam descartados como reenvio. Por isso a chave
 * de reserva inclui o que muda — dois avisos iguais colidem (é o que se quer),
 * dois avisos diferentes não.
 */
export function chaveDoEvento(body: AsaasWebhook): string | null {
  if (body.id) return body.id;
  const p = body.payment;
  if (!p?.id || !body.event) return null;
  const mutaveis = [p.status ?? "", p.value ?? "", p.dueDate ?? "", p.paymentDate ?? p.clientPaymentDate ?? ""].join("|");
  return `${p.id}:${body.event}:${impressao(mutaveis)}`;
}

/** Impressão curta e estável de uma string (FNV-1a, 32 bits em base36). */
function impressao(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Linha da tabela `payments` a partir do payload.
 *
 * `paymentDate` cai para `clientPaymentDate`: em pagamento por boleto o Asaas
 * preenche um ou outro conforme o meio, e é essa data que o regime de caixa usa.
 */
export function linhaDePagamento(p: AsaasPayment, clientId: string | null, agora = new Date()) {
  return {
    asaas_payment_id: p.id,
    client_id: clientId,
    asaas_customer_id: p.customer ?? null,
    status: p.status ?? null,
    billing_type: p.billingType ?? null,
    value: p.value ?? null,
    net_value: p.netValue ?? null,
    due_date: p.dueDate ?? null,
    payment_date: p.paymentDate ?? p.clientPaymentDate ?? null,
    description: p.description ?? null,
    invoice_url: p.invoiceUrl ?? null,
    external_reference: p.externalReference ?? null,
    raw: p,
    updated_at: agora.toISOString(),
  };
}

export type AvisoDePagamento = "recebido" | "vencido" | null;

/** Que aviso mandar ao cliente, se algum. */
export function avisoDoEvento(event: string | undefined): AvisoDePagamento {
  if (!event) return null;
  if ((EVENTOS_RECEBIDO as readonly string[]).includes(event)) return "recebido";
  if (event === "PAYMENT_OVERDUE") return "vencido";
  return null;
}

/** Valor formatado para a mensagem; sem valor, um texto neutro. */
export function valorParaAviso(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "sua fatura";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
