import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES = new Set(["ideacao", "pautas", "aprovacao", "tarefas", "producao", "concluida"]);
const FORMATS = new Set(["Feed", "Reels", "Stories", "Carrossel"]);

type PostInput = {
  id?: string;
  n?: number;
  title?: string;
  format?: string;
  pillar?: string;
  description?: string;
  legenda?: string;
  artDirection?: string;
  postDate?: string;
  weekday?: string;
  refs?: unknown;
  taskId?: string;
  tema?: string;
  assignee?: string;
  assigneeSecondary?: string;
  priority?: string;
};

type Body = {
  action?: "create-line" | "set-stage" | "set-header" | "upsert-post" | "delete-post";
  id?: string;
  lineId?: string;
  clientId?: string;
  month?: string;
  stage?: string;
  duplicateFromId?: string;
  objetivo?: string;
  narrativaCentral?: string;
  tensaoNarrativa?: string;
  datasComemorativas?: string;
  pillars?: unknown;
  moodboard?: unknown;
  post?: PostInput;
};

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
  const action = b.action ?? "set-stage";

  if (action === "create-line") {
    if (!b.clientId || !b.month?.trim()) {
      return NextResponse.json({ error: "clientId/mês obrigatórios" }, { status: 400 });
    }
    let pillars: unknown = Array.isArray(b.pillars) ? b.pillars : [];
    // Duplicar: herda pilares (e depois posts) da linha de origem.
    if (b.duplicateFromId) {
      const { data: src } = await supabase
        .from("editorial_lines")
        .select("pillars")
        .eq("id", b.duplicateFromId)
        .maybeSingle();
      if (src?.pillars) pillars = src.pillars;
    }
    const { data: line, error } = await supabase
      .from("editorial_lines")
      .insert({
        client_id: b.clientId,
        month: b.month.trim(),
        stage: "ideacao",
        objetivo: b.objetivo?.trim() || null,
        pillars,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (b.duplicateFromId) {
      const { data: srcPosts } = await supabase
        .from("editorial_posts")
        .select("n, title, format, pillar, description, art_direction")
        .eq("line_id", b.duplicateFromId)
        .order("n");
      if (srcPosts?.length) {
        await supabase.from("editorial_posts").insert(
          srcPosts.map((p) => ({
            line_id: line.id,
            n: p.n,
            title: p.title,
            format: p.format,
            pillar: p.pillar,
            description: p.description,
            art_direction: p.art_direction,
          })),
        );
      }
    }
    return NextResponse.json({ ok: true, persisted: true, id: line.id });
  }

  if (action === "set-stage") {
    if (!b.id || !b.stage || !STAGES.has(b.stage)) {
      return NextResponse.json({ error: "id/estágio inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("editorial_lines")
      .update({ stage: b.stage, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-header") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: now };
    if (b.narrativaCentral !== undefined) patch.narrativa_central = b.narrativaCentral.trim() || null;
    if (b.tensaoNarrativa !== undefined) patch.tensao_narrativa = b.tensaoNarrativa.trim() || null;
    if (b.datasComemorativas !== undefined) patch.datas_comemorativas = b.datasComemorativas.trim() || null;
    if (b.objetivo !== undefined) patch.objetivo = b.objetivo.trim() || null;
    if (Array.isArray(b.pillars)) patch.pillars = b.pillars;
    if (Array.isArray(b.moodboard)) patch.moodboard = b.moodboard;
    const { error } = await supabase.from("editorial_lines").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "delete-post") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("editorial_posts").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "upsert-post") {
    const p = b.post;
    if (!b.lineId || !p) {
      return NextResponse.json({ error: "lineId/post ausente" }, { status: 400 });
    }
    const row = {
      line_id: b.lineId,
      n: Number.isFinite(p.n) ? Number(p.n) : 0,
      title: (p.title ?? "").slice(0, 300),
      format: p.format && FORMATS.has(p.format) ? p.format : "Feed",
      pillar: p.pillar?.trim() || null,
      description: p.description ?? null,
      legenda: p.legenda ?? null,
      art_direction: p.artDirection?.trim() || "Banco do cliente",
      post_date: p.postDate?.trim() || null,
      weekday: p.weekday?.trim() || null,
      refs: Array.isArray(p.refs) ? p.refs : [],
      task_id: p.taskId || null,
      tema: p.tema ?? null,
      assignee: p.assignee?.trim() || null,
      assignee_secondary: p.assigneeSecondary?.trim() || null,
      priority: p.priority === "urgente" ? "urgente" : "normal",
      updated_at: now,
    };
    if (p.id) {
      const { error } = await supabase.from("editorial_posts").update(row).eq("id", p.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, persisted: true, id: p.id });
    }
    const { data, error } = await supabase
      .from("editorial_posts")
      .insert(row)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
