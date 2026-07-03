import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConversation } from "@/lib/data/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mensagens de uma conversa (polling do chat aberto). Zera as não-lidas. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("conversationId");
  if (!id) return NextResponse.json({ error: "conversationId ausente" }, { status: 400 });

  const data = await getConversation(id);
  if (!data) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  // Marca como lida (only quando não é polling silencioso).
  if (isSupabaseConfigured() && req.nextUrl.searchParams.get("read") === "1") {
    const supabase = await createClient();
    await supabase.from("wa_conversations").update({ unread_count: 0 }).eq("id", id);
  }

  return NextResponse.json(data);
}
