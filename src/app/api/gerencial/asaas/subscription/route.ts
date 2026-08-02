import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  isAsaasApiConfigured,
  createCustomer,
  createSubscription,
  deleteSubscription,
} from "@/lib/asaas/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** Status da cobrança recorrente + pagamentos do cliente. */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = new URL(req.url).searchParams.get("clientId") ?? "";
  if (!clientId || !isSupabaseConfigured()) {
    return NextResponse.json({ configured: isAsaasApiConfigured(), subscription: null, payments: [] });
  }
  const supabase = await createClient();
  const [subRes, payRes] = await Promise.all([
    supabase
      .from("asaas_subscriptions")
      .select("id, asaas_subscription_id, value, cycle, billing_type, status, next_due_date, description, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("payments")
      .select("asaas_payment_id, status, billing_type, value, due_date, payment_date, invoice_url")
      .eq("client_id", clientId)
      .order("due_date", { ascending: false })
      .limit(12),
  ]);
  return NextResponse.json({
    configured: isAsaasApiConfigured(),
    subscription: (subRes.data ?? [])[0] ?? null,
    payments: payRes.data ?? [],
  });
}

type Body = {
  action?: "create" | "cancel";
  clientId?: string;
  value?: number;
  cycle?: string;
  billingType?: string;
  nextDueDate?: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  description?: string;
  subscriptionId?: string;
};

const CYCLES = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"]);
const BILLING = new Set(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]);

/** Ativa (ou cancela) a cobrança recorrente do cliente no Asaas. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isAsaasApiConfigured()) {
    return NextResponse.json({ error: "Asaas não configurado (defina ASAAS_API_KEY)" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "banco indisponível" }, { status: 503 });
  }
  const supabase = await createClient();

  // Cancelar a assinatura.
  if (b.action === "cancel") {
    const subId = str(b.subscriptionId);
    if (!subId) return NextResponse.json({ error: "assinatura ausente" }, { status: 400 });
    try {
      await deleteSubscription(subId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "falha ao cancelar" }, { status: 502 });
    }
    await supabase.from("asaas_subscriptions").update({ status: "INACTIVE" }).eq("asaas_subscription_id", subId);
    return NextResponse.json({ ok: true });
  }

  // Ativar cobrança recorrente.
  const clientId = str(b.clientId);
  const value = Number(b.value);
  const cycle = CYCLES.has(str(b.cycle)) ? str(b.cycle) : "MONTHLY";
  const billingType = BILLING.has(str(b.billingType)) ? str(b.billingType) : "UNDEFINED";
  const nextDueDate = str(b.nextDueDate);
  const cpfCnpj = str(b.cpfCnpj).replace(/\D/g, "");
  if (!clientId || !(value > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
    return NextResponse.json({ error: "preencha valor e primeira cobrança" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, asaas_customer_id, cpf_cnpj")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });

  // Garante o cliente no Asaas (cria se ainda não houver).
  let customerId = str((client as { asaas_customer_id?: string }).asaas_customer_id);
  const doc = cpfCnpj || str((client as { cpf_cnpj?: string }).cpf_cnpj).replace(/\D/g, "");
  if (!customerId) {
    if (!doc) return NextResponse.json({ error: "informe o CPF/CNPJ do cliente" }, { status: 400 });
    try {
      const c = await createCustomer({
        name: String((client as { name?: string }).name ?? "Cliente"),
        cpfCnpj: doc,
        email: str(b.email) || undefined,
        mobilePhone: str(b.phone).replace(/\D/g, "") || undefined,
        externalReference: clientId,
      });
      customerId = c.id;
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "falha ao criar cliente no Asaas" }, { status: 502 });
    }
    await supabase.from("clients").update({ asaas_customer_id: customerId, cpf_cnpj: doc }).eq("id", clientId);
  }

  // Cria a assinatura recorrente.
  let sub;
  try {
    sub = await createSubscription({
      customer: customerId,
      value,
      nextDueDate,
      cycle,
      billingType,
      description: str(b.description) || "Mensalidade Viofilme",
      externalReference: clientId,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "falha ao criar assinatura" }, { status: 502 });
  }

  await supabase.from("asaas_subscriptions").insert({
    client_id: clientId,
    asaas_subscription_id: sub.id,
    value,
    cycle,
    billing_type: billingType,
    status: sub.status ?? "ACTIVE",
    next_due_date: nextDueDate,
    description: str(b.description) || "Mensalidade Viofilme",
  });

  return NextResponse.json({ ok: true, subscriptionId: sub.id });
}
