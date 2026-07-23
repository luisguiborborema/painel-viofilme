import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { PIPELINE_PREVENDA_ID, STAGE_RESERVOIR } from "@/lib/data/crm";
import { formatPhone } from "@/lib/data/inbox";
import { resolveAssignee } from "@/lib/crm/assign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria um negócio a partir de uma conversa do inbox (fecha o funil: chegou pelo
 * WhatsApp → vira lead com contexto). Nasce em Pré-venda / Contactar Urgente,
 * origem inbound, e leva o histórico da conversa anexado à timeline.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.conversationId) return NextResponse.json({ error: "conversationId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("wa_conversations")
    .select("id,phone,name,lead_id")
    .eq("id", body.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });
  if (conv.lead_id) return NextResponse.json({ ok: true, leadId: String(conv.lead_id), already: true });

  const now = new Date().toISOString();
  const phone = conv.phone ? String(conv.phone) : "";
  const name = (conv.name && String(conv.name).trim()) || formatPhone(phone) || "Contato WhatsApp";
  const owner = await resolveAssignee(supabase, { fallback: user.name, originKind: "inbound" });

  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("pipeline_id", PIPELINE_PREVENDA_ID)
    .eq("key", STAGE_RESERVOIR)
    .maybeSingle();

  const { data: co } = await supabase.from("crm_companies").insert({ name, owner }).select("id").single();
  const companyId = co?.id ?? null;
  const { data: ct } = await supabase
    .from("crm_contacts")
    .insert({ company_id: companyId, name, phone: phone || null, is_primary: true, owner })
    .select("id")
    .single();
  const contactId = ct?.id ?? null;

  const { data: deal, error } = await supabase
    .from("crm_leads")
    .insert({
      name,
      stage: STAGE_RESERVOIR,
      stage_id: stage?.id ?? null,
      pipeline_id: PIPELINE_PREVENDA_ID,
      origin_kind: "inbound",
      source: "WhatsApp",
      owner,
      assignees: [owner],
      company_id: companyId,
      primary_contact_id: contactId,
      contact_name: name,
      contact_phone: phone || null,
      probability: 10,
      monthly_value: 0,
      media_budget: 0,
      bant: {},
      stage_changed_at: now,
    })
    .select("id")
    .single();
  if (error || !deal) return NextResponse.json({ error: error?.message ?? "falha" }, { status: 500 });

  await supabase.from("wa_conversations").update({ lead_id: deal.id }).eq("id", body.conversationId);
  if (contactId) await supabase.from("crm_deal_contacts").insert({ deal_id: deal.id, contact_id: contactId, is_primary: true });

  // Histórico da conversa anexado à timeline.
  const { data: msgs } = await supabase
    .from("wa_messages")
    .select("direction,body,type,created_at")
    .eq("conversation_id", body.conversationId)
    .order("created_at", { ascending: true })
    .limit(40);
  const history = (msgs ?? [])
    .map((m) => `${m.direction === "in" ? "←" : "→"} ${m.body ? String(m.body) : `[${m.type}]`}`)
    .join("\n");
  await supabase.from("crm_interactions").insert({
    lead_id: deal.id,
    channel: "whatsapp",
    author: user.name,
    body: `💬 Negócio criado a partir da conversa de WhatsApp.${history ? `\n\n${history}` : ""}`.slice(0, 4000),
  });

  return NextResponse.json({ ok: true, persisted: true, leadId: String(deal.id) });
}
