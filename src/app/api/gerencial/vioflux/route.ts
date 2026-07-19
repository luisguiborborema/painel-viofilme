import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATES = new Set(["rascunho", "aguardando", "aprovado", "ajuste", "agendado", "publicado", "falha"]);
const NETS = new Set(["instagram", "facebook"]);

type Body = {
  action?: "create" | "set-state" | "schedule" | "request-change" | "delete";
  id?: string;
  clientId?: string;
  title?: string;
  caption?: string;
  format?: string;
  networks?: string[];
  state?: string;
  scheduledAt?: string;
  comment?: string;
  taskId?: string;
};

/** Ciclo manual do VioFlux (FLX04.2), persistido sobre vioflux_posts. */
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

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (b.action === "create") {
    if (!b.clientId || !b.title?.trim()) {
      return NextResponse.json({ error: "clientId/title ausente" }, { status: 400 });
    }
    const networks = (b.networks ?? ["instagram"]).filter((n) => NETS.has(n));
    const state = b.state && STATES.has(b.state) ? b.state : "rascunho";
    const { data, error } = await supabase
      .from("vioflux_posts")
      .insert({
        client_id: b.clientId,
        task_id: b.taskId ?? null,
        title: b.title.trim(),
        caption: b.caption ?? null,
        format: b.format ?? "Feed",
        networks: networks.length ? networks : ["instagram"],
        state,
        scheduled_at: b.scheduledAt ?? null,
        media_note: "Mídia anexada",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  }

  if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  if (b.action === "delete") {
    const { error } = await supabase.from("vioflux_posts").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Pedir ajuste — volta o post para a produção (backstage) com o comentário.
  if (b.action === "request-change") {
    const { data: row, error } = await supabase
      .from("vioflux_posts")
      .update({ state: "ajuste", client_comment: b.comment?.trim() || null, updated_at: now })
      .eq("id", b.id)
      .select("task_id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // FLX01: reabre a task no estágio de ajuste (revisão interna).
    const taskId = (row as { task_id: string | null } | null)?.task_id;
    if (taskId) {
      await supabase.from("delivery_tasks").update({ stage: "review", updated_at: now }).eq("id", taskId);
    }
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Registrar agendamento (espelho — não publica).
  if (b.action === "schedule") {
    if (!b.scheduledAt) return NextResponse.json({ error: "scheduledAt ausente" }, { status: 400 });
    const { error } = await supabase
      .from("vioflux_posts")
      .update({ state: "agendado", scheduled_at: b.scheduledAt, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Mudança de estado direta (enviar aprovação / aprovar / publicar).
  if (b.action === "set-state") {
    if (!b.state || !STATES.has(b.state)) {
      return NextResponse.json({ error: "estado inválido" }, { status: 400 });
    }
    const patch: Record<string, unknown> = { state: b.state, updated_at: now };
    if (b.state === "aguardando" || b.state === "aprovado") patch.client_comment = null;
    const { data: row, error } = await supabase
      .from("vioflux_posts")
      .update(patch)
      .eq("id", b.id)
      .select("task_id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // FLX01: publicado → fecha a task de origem.
    const taskId = (row as { task_id: string | null } | null)?.task_id;
    if (b.state === "publicado" && taskId) {
      await supabase.from("delivery_tasks").update({ stage: "done", updated_at: now }).eq("id", taskId);
    }
    return NextResponse.json({ ok: true, persisted: true });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
