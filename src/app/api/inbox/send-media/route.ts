import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappMedia, type WaMediaType } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLACEHOLDER: Record<WaMediaType, string> = {
  image: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  document: "[documento]",
};

/** Envia mídia (URL pública) pelo inbox via Uazapi e registra na conversa. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let b: {
    conversationId?: string;
    type?: WaMediaType;
    fileUrl?: string;
    caption?: string;
    filename?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const type = b.type ?? "document";
  if (!b.conversationId || !b.fileUrl) {
    return NextResponse.json({ error: "conversationId/fileUrl ausente" }, { status: 400 });
  }

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
    sent = await sendWhatsappMedia(String(conv.phone), type, b.fileUrl, {
      caption: b.caption,
      filename: b.filename,
    });
  }

  const now = new Date().toISOString();
  const preview = b.caption?.trim() || PLACEHOLDER[type];
  await supabase.from("wa_messages").insert({
    conversation_id: conv.id,
    direction: "out",
    type,
    body: b.caption?.trim() || null,
    media_url: b.fileUrl,
    author: user.name,
    status: sent ? "sent" : null,
  });
  await supabase
    .from("wa_conversations")
    .update({
      last_message_at: now,
      last_message_preview: preview.slice(0, 120),
      last_direction: "out",
      unread_count: 0,
      updated_at: now,
    })
    .eq("id", conv.id);

  if (conv.lead_id) {
    await supabase.from("crm_interactions").insert({
      lead_id: conv.lead_id,
      channel: "whatsapp",
      direction: "out",
      body: preview,
      author: user.name,
    });
  }

  return NextResponse.json({ ok: true, persisted: true, sent });
}
