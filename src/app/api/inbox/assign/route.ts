import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status válidos de uma conversa. Fora desta lista ela some do inbox: as abas
 * filtram por estes três, e uma conversa em status desconhecido não aparece em
 * nenhuma — fica invisível sem que nada acuse.
 */
const STATUS = new Set(["open", "pending", "closed"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (b.status !== undefined && !STATUS.has(String(b.status))) {
    return NextResponse.json(
      { error: `status inválido: ${String(b.status)} (use open, pending ou closed)` },
      { status: 400 },
    );
  }
  if (b.assignedTo !== undefined && b.assignedTo !== null && !UUID.test(String(b.assignedTo))) {
    return NextResponse.json({ error: "atendente inválido" }, { status: 400 });
  }
  if (b.assignedTo === undefined && b.status === undefined) {
    return NextResponse.json({ error: "nada para alterar" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.assignedTo !== undefined) patch.assigned_to = b.assignedTo;
  if (b.status !== undefined) patch.status = b.status;

  const supabase = await createClient();
  // `count` para distinguir "alterei" de "não existe": sem isso, atribuir a uma
  // conversa inexistente responde 200 e nada acontece.
  const { error, count } = await supabase
    .from("wa_conversations")
    .update(patch, { count: "exact" })
    .eq("id", b.conversationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, persisted: true });
}
