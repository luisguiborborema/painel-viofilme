import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vincula uma conversa do inbox a um negócio já existente. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: { conversationId?: string; leadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.conversationId || !body.leadId) {
    return NextResponse.json({ error: "conversationId/leadId ausente" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const supabase = await createClient();

  // Confere os dois lados ANTES de gravar. Sem isto, um id inexistente estoura
  // na chave estrangeira e devolve a mensagem crua do Postgres num 500 — quem
  // vê na tela não faz ideia do que deu errado.
  const [{ data: conv }, { data: lead }] = await Promise.all([
    supabase.from("wa_conversations").select("id").eq("id", body.conversationId).maybeSingle(),
    supabase.from("crm_leads").select("id").eq("id", body.leadId).maybeSingle(),
  ]);
  if (!conv) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });
  if (!lead) return NextResponse.json({ error: "negócio não encontrado" }, { status: 404 });

  const { error } = await supabase.from("wa_conversations").update({ lead_id: body.leadId }).eq("id", body.conversationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("crm_interactions").insert({
    lead_id: body.leadId,
    channel: "whatsapp",
    author: user.name,
    body: "💬 Conversa de WhatsApp vinculada a este negócio.",
  });
  return NextResponse.json({ ok: true, persisted: true });
}
