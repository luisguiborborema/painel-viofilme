import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES = new Set(["todo", "doing", "review", "approval", "done"]);
const TYPES = new Set(["Arte", "Vídeo", "Copy", "Tráfego"]);
const ORIGINS = new Set(["Linha editorial", "Projeto", "Tarefa avulsa", "Performance"]);
const GOALS = new Set(["conversao", "trafego", "alcance", "reconhecimento"]);
const CONTENT_FORMATS = new Set(["Reels", "Feed", "Stories", "Carrossel"]);
const PRIORITIES = new Set(["baixa", "media", "alta", "urgente"]);

type Body = {
  action?:
    | "create"
    | "set-stage"
    | "set-assignee"
    | "set-assignees"
    | "set-priority"
    | "set-requester"
    | "set-type"
    | "log-hours"
    | "set-checklist"
    | "add-comment"
    | "react-comment"
    | "set-custom"
    | "delete";
  id?: string;
  title?: string;
  clientId?: string;
  type?: string;
  origin?: string;
  assignee?: string;
  assignees?: string[];
  requester?: string;
  priority?: string;
  stage?: string;
  dueDate?: string;
  estimateH?: number;
  urgent?: boolean;
  hours?: number;
  checklist?: unknown;
  comment?: {
    author?: string;
    text?: string;
    parentId?: string;
    attachments?: { name?: string; url?: string }[];
  };
  commentId?: string;
  emoji?: string;
  customFields?: Record<string, unknown>;
  campaignGoal?: string;
  contentFormat?: string;
};

type RawComment = {
  id?: string;
  author?: string;
  text?: string;
  parentId?: string;
  reactions?: Record<string, string[]>;
  attachments?: { name: string; url: string }[];
  createdAt?: string;
};

function cryptoId(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Histórico de etapa de uma tarefa (cycle time). GET ?history=<taskId> */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const activityId = url.searchParams.get("activity");
  const id = url.searchParams.get("history") ?? activityId;
  if (!id) return NextResponse.json({ history: [] });
  if (!isSupabaseConfigured()) return NextResponse.json({ history: [], comments: [] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_task_status_history")
    .select("from_status, to_status, changed_at")
    .eq("task_id", id)
    .order("changed_at", { ascending: true })
    .limit(100);

  // Feed de atividade (C4) + campos da task (C2b): solicitante/tipo/colaboradores/horas.
  if (activityId) {
    const { data: task } = await supabase
      .from("delivery_tasks")
      .select("comments, requester, type, assignees, assignee, logged_h")
      .eq("id", activityId)
      .maybeSingle();
    const t = task as { comments?: unknown; requester?: string | null; type?: string | null; assignees?: string[] | null; assignee?: string | null; logged_h?: number | null } | null;
    const comments = Array.isArray(t?.comments) ? t!.comments : [];
    return NextResponse.json({
      history: data ?? [],
      comments,
      task: t
        ? { requester: t.requester ?? "", type: t.type ?? "", assignees: Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : []), loggedH: Number(t.logged_h ?? 0) }
        : null,
    });
  }
  return NextResponse.json({ history: data ?? [] });
}

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

  if (action === "set-assignees") {
    if (!b.id || !Array.isArray(b.assignees)) {
      return NextResponse.json({ error: "id/responsáveis inválido" }, { status: 400 });
    }
    const list = b.assignees.map((a) => String(a).trim()).filter(Boolean).slice(0, 10);
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ assignees: list, assignee: list[0] ?? null, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-priority") {
    if (!b.id || !b.priority || !PRIORITIES.has(b.priority)) {
      return NextResponse.json({ error: "id/prioridade inválida" }, { status: 400 });
    }
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ priority: b.priority, urgent: b.priority === "urgente", updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-requester") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ requester: b.requester?.trim() || null, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-type") {
    if (!b.id || !b.type || !TYPES.has(b.type)) {
      return NextResponse.json({ error: "id/tipo inválido" }, { status: 400 });
    }
    const { error } = await supabase.from("delivery_tasks").update({ type: b.type, updated_at: now }).eq("id", b.id);
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

  if (action === "set-custom") {
    if (!b.id || typeof b.customFields !== "object" || b.customFields === null) {
      return NextResponse.json({ error: "id/campos inválidos" }, { status: 400 });
    }
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ custom_fields: b.customFields, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
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
    const atts = Array.isArray(b.comment?.attachments)
      ? b.comment.attachments
          .filter((a) => a && typeof a.url === "string")
          .slice(0, 8)
          .map((a) => ({ name: String(a.name ?? "arquivo").slice(0, 120), url: String(a.url) }))
      : [];
    const entry = {
      id: cryptoId(),
      author: (b.comment?.author ?? "Equipe").slice(0, 80),
      text: text.slice(0, 2000),
      parentId: b.comment?.parentId || undefined,
      reactions: {},
      attachments: atts,
      createdAt: now,
    };
    const next = [...list, entry].slice(-200);
    const { error } = await supabase
      .from("delivery_tasks")
      .update({ comments: next, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: entry.id });
  }

  if (action === "react-comment") {
    if (!b.id || !b.commentId || !b.emoji) {
      return NextResponse.json({ error: "dados da reação ausentes" }, { status: 400 });
    }
    const who = (b.comment?.author ?? user.name ?? "Equipe").slice(0, 80);
    const { data: cur } = await supabase
      .from("delivery_tasks")
      .select("comments")
      .eq("id", b.id)
      .maybeSingle();
    const list = Array.isArray(cur?.comments) ? (cur!.comments as RawComment[]) : [];
    const next = list.map((c) => {
      if (c.id !== b.commentId) return c;
      const reactions = { ...(c.reactions ?? {}) };
      const arr = new Set(reactions[b.emoji!] ?? []);
      if (arr.has(who)) arr.delete(who);
      else arr.add(who);
      if (arr.size) reactions[b.emoji!] = [...arr];
      else delete reactions[b.emoji!];
      return { ...c, reactions };
    });
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
      urgent: Boolean(b.urgent) || b.priority === "urgente",
      priority: b.priority && PRIORITIES.has(b.priority) ? b.priority : "media",
      assignees: Array.isArray(b.assignees) && b.assignees.length ? b.assignees.map((a) => String(a).trim()).filter(Boolean) : b.assignee?.trim() ? [b.assignee.trim()] : [],
      requester: b.requester?.trim() || null,
      campaign_goal: b.campaignGoal && GOALS.has(b.campaignGoal) ? b.campaignGoal : null,
      content_format: b.contentFormat && CONTENT_FORMATS.has(b.contentFormat) ? b.contentFormat : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
