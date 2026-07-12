import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { trigger } from "@/lib/push/triggers";

/** Notifica responsáveis do negócio + @menções (best-effort, não bloqueia). */
async function notifyComment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  authorName: string,
  body: string,
) {
  try {
    const { data: deal } = await supabase
      .from("crm_leads")
      .select("name, owner, assignees")
      .eq("id", leadId)
      .maybeSingle();
    if (!deal) return;
    const responsaveis = new Set<string>([
      ...(((deal.assignees as string[] | null) ?? []) as string[]),
      ...(deal.owner ? [String(deal.owner)] : []),
    ]);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, whatsapp")
      .eq("role", "gerencial");
    const recipients: { userId?: string | null; whatsapp?: string | null }[] = [];
    for (const p of profs ?? []) {
      const fn = p.full_name ? String(p.full_name) : "";
      if (!fn || fn === authorName) continue; // não notifica o autor
      if (responsaveis.has(fn) || body.includes(`@${fn}`)) {
        recipients.push({ userId: String(p.id), whatsapp: p.whatsapp ? String(p.whatsapp) : null });
      }
    }
    if (recipients.length) {
      await trigger.dealComment(recipients, {
        dealName: String(deal.name ?? "Negócio"),
        author: authorName,
        preview: body.slice(0, 140),
        url: `/gerencial/crm/${leadId}`,
      });
    }
  } catch {
    /* best-effort */
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "edit" | "delete" | "react";
  id?: string;
  leadId?: string;
  parentId?: string | null;
  body?: string;
  emoji?: string;
};

/** Comentários internos de um negócio: criar, editar, excluir, responder, reagir. */
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
  const action = b.action ?? (b.id ? "edit" : "create");

  if (!isSupabaseConfigured()) {
    // Modo demo: id temporário para a UI otimista (não persiste).
    return NextResponse.json({ ok: true, persisted: false, id: `tmp-${Date.now()}` });
  }
  const supabase = await createClient();
  const now = new Date().toISOString();

  /** Só o autor (ou um Gestor) pode editar/excluir. */
  async function assertOwner(id: string): Promise<NextResponse | null> {
    const { data } = await supabase
      .from("crm_comments")
      .select("author_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "comentário não encontrado" }, { status: 404 });
    const authorId = data.author_id ? String(data.author_id) : null;
    if (authorId && authorId !== user!.id && !hasFullAccess(user!.allowedSections)) {
      return NextResponse.json({ error: "sem permissão" }, { status: 403 });
    }
    return null;
  }

  if (action === "create") {
    if (!b.leadId || !b.body?.trim()) {
      return NextResponse.json({ error: "leadId/body ausente" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("crm_comments")
      .insert({
        lead_id: b.leadId,
        parent_id: b.parentId ?? null,
        author: user.name,
        author_id: user.id,
        body: b.body.trim(),
      })
      .select("id,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await notifyComment(supabase, b.leadId, user.name, b.body.trim());
    return NextResponse.json({ ok: true, persisted: true, id: data.id, createdAt: data.created_at });
  }

  if (action === "edit") {
    if (!b.id || !b.body?.trim()) {
      return NextResponse.json({ error: "id/body ausente" }, { status: 400 });
    }
    const denied = await assertOwner(b.id);
    if (denied) return denied;
    const { error } = await supabase
      .from("crm_comments")
      .update({ body: b.body.trim(), edited: true, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const denied = await assertOwner(b.id);
    if (denied) return denied;
    // Respostas caem em cascata (parent_id ... on delete cascade).
    const { error } = await supabase.from("crm_comments").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "react") {
    if (!b.id || !b.emoji) {
      return NextResponse.json({ error: "id/emoji ausente" }, { status: 400 });
    }
    const { data: cur } = await supabase
      .from("crm_comments")
      .select("reactions")
      .eq("id", b.id)
      .maybeSingle();
    const reactions: Record<string, string[]> =
      (cur?.reactions as Record<string, string[]> | null) ?? {};
    const set = new Set(reactions[b.emoji] ?? []);
    if (set.has(user.name)) set.delete(user.name);
    else set.add(user.name);
    if (set.size) reactions[b.emoji] = [...set];
    else delete reactions[b.emoji];
    const { error } = await supabase
      .from("crm_comments")
      .update({ reactions })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, reactions });
  }

  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
