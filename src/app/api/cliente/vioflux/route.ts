import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "approve" | "request-change";
  id?: string;
  comment?: string;
};

/** Aprovação do cliente sobre os posts do VioFlux (FLX05, round-trip). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "cliente" || !user.clientId) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Só aprova/ajusta posts que estão aguardando aprovação, do próprio cliente.
  if (b.action === "approve") {
    const { error } = await supabase
      .from("vioflux_posts")
      .update({ state: "aprovado", client_comment: null, updated_at: now })
      .eq("id", b.id)
      .eq("client_id", user.clientId)
      .eq("state", "aguardando");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "request-change") {
    if (!b.comment?.trim()) {
      return NextResponse.json({ error: "comentário obrigatório" }, { status: 400 });
    }
    const { data: row, error } = await supabase
      .from("vioflux_posts")
      .update({ state: "ajuste", client_comment: b.comment.trim(), updated_at: now })
      .eq("id", b.id)
      .eq("client_id", user.clientId)
      .eq("state", "aguardando")
      .select("task_id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // FLX01: reabre a task de origem no backstage (revisão interna).
    const taskId = (row as { task_id: string | null } | null)?.task_id;
    if (taskId) {
      await supabase.from("delivery_tasks").update({ stage: "review", updated_at: now }).eq("id", taskId);
    }
    return NextResponse.json({ ok: true, persisted: true });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
