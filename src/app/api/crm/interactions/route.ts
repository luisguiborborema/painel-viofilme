import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  leadId?: string;
  channel?: "whatsapp" | "email" | "call" | "note";
  body?: string;
  bant?: Record<string, string>;
  /** Quando true e canal whatsapp: envia a mensagem via Uazapi ao contato. */
  send?: boolean;
  toPhone?: string;
};

/** Registra uma interação na timeline do lead (e opcionalmente envia WhatsApp). */
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
  if (!b.leadId || !b.body?.trim()) {
    return NextResponse.json({ error: "leadId/body ausente" }, { status: 400 });
  }

  const channel = b.channel ?? "note";
  const direction = channel === "whatsapp" && b.send ? "out" : null;

  // Envia WhatsApp de fato (canal whatsapp + send + número).
  let sent = false;
  if (channel === "whatsapp" && b.send && b.toPhone && isWhatsappConfigured()) {
    sent = await sendWhatsappText(b.toPhone, b.body);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, sent });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const meta = b.bant ? { bant: b.bant } : {};

  const { error } = await supabase.from("crm_interactions").insert({
    lead_id: b.leadId,
    channel,
    direction,
    body: b.body.trim(),
    author: user.name,
    meta,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atualiza último contato (e BANT do lead, se veio da /qualificação).
  const patch: Record<string, unknown> = { last_interaction_at: now, updated_at: now };
  if (b.bant && Object.keys(b.bant).length > 0) {
    const { data: cur } = await supabase
      .from("crm_leads")
      .select("bant")
      .eq("id", b.leadId)
      .maybeSingle();
    patch.bant = { ...(cur?.bant ?? {}), ...b.bant };
  }
  await supabase.from("crm_leads").update(patch).eq("id", b.leadId);

  return NextResponse.json({ ok: true, persisted: true, sent });
}
