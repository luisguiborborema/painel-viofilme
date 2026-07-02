import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import {
  ASAAS_WEBHOOK_TOKEN,
  isAsaasWebhookConfigured,
  safeEqual,
} from "@/lib/asaas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasPayment = {
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

type AsaasWebhook = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
};

export async function POST(req: Request) {
  // 1. Autenticação: token que o Asaas envia no header.
  const provided = req.headers.get("asaas-access-token") ?? "";
  if (!isAsaasWebhookConfigured() || !safeEqual(provided, ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // 2. Payload.
  let body: AsaasWebhook;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const event = body.event;
  const payment = body.payment;
  const eventId = body.id ?? (payment ? `${payment.id}:${event}` : null);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  // 3. Precisa do banco (service-role). Se indisponível, 503 → Asaas reenvia.
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "armazenamento indisponível" },
      { status: 503 },
    );
  }
  const admin = createAdminClient();

  // 4. Idempotência: ignora reenvios já processados.
  if (eventId) {
    const { data: seen } = await admin
      .from("asaas_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  // 5. Grava/atualiza o pagamento.
  if (payment?.id) {
    // Resolve o cliente: 1) externalReference = nosso client_id; 2) asaas_customer_id.
    let clientId: string | null = null;
    if (payment.externalReference) {
      const { data } = await admin
        .from("clients")
        .select("id")
        .eq("id", payment.externalReference)
        .maybeSingle();
      clientId = data?.id ?? null;
    }
    if (!clientId && payment.customer) {
      const { data } = await admin
        .from("clients")
        .select("id")
        .eq("asaas_customer_id", payment.customer)
        .maybeSingle();
      clientId = data?.id ?? null;
    }

    const { error } = await admin.from("payments").upsert(
      {
        asaas_payment_id: payment.id,
        client_id: clientId,
        asaas_customer_id: payment.customer ?? null,
        status: payment.status ?? null,
        billing_type: payment.billingType ?? null,
        value: payment.value ?? null,
        net_value: payment.netValue ?? null,
        due_date: payment.dueDate ?? null,
        payment_date: payment.paymentDate ?? payment.clientPaymentDate ?? null,
        description: payment.description ?? null,
        invoice_url: payment.invoiceUrl ?? null,
        external_reference: payment.externalReference ?? null,
        raw: payment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "asaas_payment_id" },
    );
    if (error) {
      // Falha real de gravação → 500 para o Asaas reenviar.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 6. Registra o evento (idempotência + auditoria).
  if (eventId) {
    await admin.from("asaas_webhook_events").insert({
      event_id: eventId,
      event,
      payment_id: payment?.id ?? null,
      raw: body,
    });
  }

  return NextResponse.json({ ok: true });
}
