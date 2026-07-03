import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  leadId?: string;
  startDate?: string; // "01/07/2025"
  monthlyValue?: number;
  mediaBudget?: number;
  plan?: string;
  owner?: string;
  source?: string;
};

/**
 * Gatilho "Lead Ganho" (automação core). Marca o lead como ganho e dispara as
 * automações dos outros módulos. Nesta fase: cria o cliente real (M3/Portal) e
 * registra na timeline as automações executadas — fatura (M4/Asaas), ficha CS
 * (M5), acesso ao portal e contrato ficam simulados até serem ligados.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.leadId) {
    return NextResponse.json({ error: "leadId ausente" }, { status: 400 });
  }

  const automations = [
    { module: "M3", label: "Projeto criado no módulo Operação", done: true },
    { module: "M4", label: "Primeira fatura gerada no Financeiro (via Asaas)", done: false },
    { module: "M5", label: "Ficha de CS criada com histórico do lead", done: false },
    { module: "Portal", label: "Acesso ao Portal do Cliente enviado", done: false },
    { module: "Contrato", label: "Contrato enviado para assinatura digital", done: false },
  ];

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, automations });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Carrega o lead.
  const { data: lead, error: leadErr } = await supabase
    .from("crm_leads")
    .select("id,name,segment,monthly_value")
    .eq("id", b.leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });
  }

  // Automação real: cria o cliente (Operação + Portal).
  let clientId: string | null = null;
  const { data: created } = await supabase
    .from("clients")
    .insert({
      name: lead.name,
      segment: lead.segment ?? null,
      status: "onboarding",
      monthly_fee: b.monthlyValue ?? lead.monthly_value ?? 0,
    })
    .select("id")
    .single();
  clientId = created?.id ?? null;
  if (clientId) automations[0].done = true;

  // Marca o lead como ganho.
  await supabase
    .from("crm_leads")
    .update({
      stage: "ganho",
      won_at: now,
      stage_changed_at: now,
      converted_client_id: clientId,
      monthly_value: b.monthlyValue ?? lead.monthly_value,
      media_budget: b.mediaBudget,
      plan: b.plan,
      updated_at: now,
    })
    .eq("id", b.leadId);

  // Registra as automações na timeline.
  const summary = automations
    .map((a) => `${a.done ? "✅" : "⏳"} ${a.label}`)
    .join("\n");
  await supabase.from("crm_interactions").insert({
    lead_id: b.leadId,
    channel: "system",
    body: `🏆 Lead Ganho — onboarding iniciado.\n${summary}`,
    author: user.name,
    meta: { automations, startDate: b.startDate ?? null, clientId },
  });

  return NextResponse.json({ ok: true, persisted: true, clientId, automations });
}
