import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Envia uma mensagem de texto pelo inbox (Uazapi) e registra na conversa. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let b: { conversationId?: string; text?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.conversationId || !b.text?.trim()) {
    return NextResponse.json({ error: "conversationId/text ausente" }, { status: 400 });
  }
  const text = b.text.trim();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("wa_conversations")
    .select("id,phone,lead_id")
    .eq("id", b.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

  let sent = false;
  if (isWhatsappConfigured()) {
    sent = await sendWhatsappText(String(conv.phone), text);
  }

  const now = new Date().toISOString();
  await supabase.from("wa_messages").insert({
    conversation_id: conv.id,
    direction: "out",
    type: "text",
    body: text,
    author: user.name,
    status: sent ? "sent" : null,
  });
  await supabase
    .from("wa_conversations")
    .update({
      last_message_at: now,
      last_message_preview: text.slice(0, 120),
      last_direction: "out",
      unread_count: 0,
      updated_at: now,
    })
    .eq("id", conv.id);

  // Espelha na timeline do lead vinculado, se houver.
  if (conv.lead_id) {
    await supabase.from("crm_interactions").insert({
      lead_id: conv.lead_id,
      channel: "whatsapp",
      direction: "out",
      body: text,
      author: user.name,
    });
    await supabase
      .from("crm_leads")
      .update({ last_interaction_at: now })
      .eq("id", conv.lead_id);
  }

  return NextResponse.json({ ok: true, persisted: true, sent });
}
