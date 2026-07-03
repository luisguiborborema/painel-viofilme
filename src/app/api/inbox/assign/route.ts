import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Atribui um atendente à conversa e/ou muda o status (open|pending|closed). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let b: {
    conversationId?: string;
    assignedTo?: string | null;
    status?: "open" | "pending" | "closed";
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.conversationId) {
    return NextResponse.json({ error: "conversationId ausente" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.assignedTo !== undefined) patch.assigned_to = b.assignedTo;
  if (b.status) patch.status = b.status;

  const supabase = await createClient();
  const { error } = await supabase
    .from("wa_conversations")
    .update(patch)
    .eq("id", b.conversationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
