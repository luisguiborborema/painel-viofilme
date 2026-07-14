import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES = new Set(["todo", "doing", "review", "approval", "done"]);
const TYPES = new Set(["Arte", "Vídeo", "Copy", "Tráfego"]);
const ORIGINS = new Set(["Linha editorial", "Projeto", "Tarefa avulsa"]);

type Body = {
  action?:
    | "create"
    | "set-stage"
    | "set-assignee"
    | "log-hours"
    | "set-checklist"
    | "add-comment"
    | "delete";
  id?: string;
  title?: string;
  clientId?: string;
  type?: string;
  origin?: string;
  assignee?: string;
  stage?: string;
  dueDate?: string;
  estimateH?: number;
  urgent?: boolean;
  hours?: number;
  checklist?: unknown;
  comment?: { author?: string; text?: string };
};

/** Tarefas de entrega / produção (gerencial). */
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
  const action = b.action ?? "create";
  const now = new Date().toISOString();

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("delivery_tasks").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-stage") {
    if (!b.id || !b.stage || !STAGES.has(b.stage)) {
      return NextResponse.json({ error: "id/estágio inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ stage: b.stage, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-assignee") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ assignee: b.assignee?.trim() || null, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "log-hours") {
    const hours = Number(b.hours);
    if (!b.id || !Number.isFinite(hours)) {
      return NextResponse.json({ error: "id/horas inválido" }, { status: 400 });
    }
    const { data: cur } = await supabase
      .from("delivery_tasks")
      .select("logged_h")
      .eq("id", b.id)
      .maybeSingle();
    const next = Math.max(0, Number(cur?.logged_h ?? 0) + hours);
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ logged_h: next, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, loggedH: next });
  }

  if (action === "set-checklist") {
    if (!b.id || !Array.isArray(b.checklist)) {
      return NextResponse.json({ error: "id/checklist inválido" }, { status: 400 });
    }
    const clean = (b.checklist as unknown[])
      .slice(0, 50)
      .map((x) => {
        const it = x as { label?: unknown; done?: unknown };
        return { label: String(it.label ?? "").slice(0, 200), done: Boolean(it.done) };
      })
      .filter((x) => x.label);
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ checklist: clean, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "add-comment") {
    const text = b.comment?.text?.trim();
    if (!b.id || !text) {
      return NextResponse.json({ error: "id/comentário ausente" }, { status: 400 });
    }
    const { data: cur } = await supabase
      .from("delivery_tasks")
      .select("comments")
      .eq("id", b.id)
      .maybeSingle();
    const list = Array.isArray(cur?.comments) ? (cur!.comments as unknown[]) : [];
    const next = [
      ...list,
      { author: (b.comment?.author ?? "Equipe").slice(0, 80), text: text.slice(0, 1000) },
    ].slice(-100);
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ comments: next, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  const title = (b.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "título obrigatório" }, { status: 400 });
  const { data, error } = await supabase
    .from("delivery_tasks")
    .insert({
      title,
      client_id: b.clientId || null,
      type: b.type && TYPES.has(b.type) ? b.type : "Arte",
      origin: b.origin && ORIGINS.has(b.origin) ? b.origin : "Tarefa avulsa",
      assignee: b.assignee?.trim() || null,
      stage: b.stage && STAGES.has(b.stage) ? b.stage : "todo",
      due_date: b.dueDate || null,
      estimate_h: Number.isFinite(Number(b.estimateH)) ? Number(b.estimateH) : 0,
      urgent: Boolean(b.urgent),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
