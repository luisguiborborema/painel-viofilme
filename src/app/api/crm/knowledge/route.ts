import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { paginaValida, categoriaValida, MAX_CONTEUDO } from "@/lib/data/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Base de conhecimento: processos e playbooks do time.
 *
 * A tabela existe desde a 0081 e só era lida — escrever dependia de mexer no
 * banco. Aqui entram criação e edição de páginas e categorias.
 */
type Body = {
  action?: "save-page" | "delete-page" | "save-category" | "delete-category" | "toggle-pin";
  id?: string;
  categoryId?: string | null;
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  videoUrl?: string;
  pinned?: boolean;
  name?: string;
  color?: string;
};

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ page: null });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_pages")
    .select("id, category_id, title, summary, content, tags, video_url, pinned, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "página não encontrada" }, { status: 404 });

  const p = data as Record<string, unknown>;
  return NextResponse.json({
    page: {
      id: String(p.id),
      categoryId: (p.category_id as string) ?? null,
      title: String(p.title ?? ""),
      summary: (p.summary as string) ?? "",
      content: (p.content as string) ?? "",
      tags: Array.isArray(p.tags) ? p.tags : [],
      videoUrl: (p.video_url as string) ?? "",
      pinned: Boolean(p.pinned),
      updatedAt: String(p.updated_at ?? ""),
    },
  });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  // Ação desconhecida não pode cair na criação de página.
  const ACOES = new Set(["save-page", "delete-page", "save-category", "delete-category", "toggle-pin"]);
  if (b.action !== undefined && !ACOES.has(String(b.action))) {
    return NextResponse.json({ error: `ação desconhecida: ${String(b.action)}` }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  try {
    if (b.action === "delete-page") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      await logFromUser(user, { action: "delete", area: "Base de conhecimento", target: b.id });
      const { error } = await supabase.from("knowledge_pages").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (b.action === "toggle-pin") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase
        .from("knowledge_pages")
        .update({ pinned: Boolean(b.pinned), updated_at: now })
        .eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, pinned: Boolean(b.pinned) });
    }

    if (b.action === "save-category") {
      const val = categoriaValida(b.name, b.color);
      if (!val.ok) return NextResponse.json({ error: val.erro }, { status: 400 });
      const linha = { name: val.nome, color: val.cor };
      if (b.id) {
        const { error } = await supabase.from("knowledge_categories").update(linha).eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true, id: b.id });
      }
      const { data, error } = await supabase.from("knowledge_categories").insert(linha).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, id: String(data.id) });
    }

    if (b.action === "delete-category") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      // A FK é `on delete set null`: as páginas ficam sem categoria, não somem.
      const { error } = await supabase.from("knowledge_categories").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // save-page (padrão)
    const val = paginaValida(b);
    if (!val.ok) return NextResponse.json({ error: val.erro }, { status: 400 });

    const linha = {
      category_id: b.categoryId || null,
      title: val.pagina.title,
      summary: val.pagina.summary,
      content: val.pagina.content,
      tags: val.pagina.tags,
      video_url: val.pagina.videoUrl,
      updated_at: now,
    };

    if (b.id) {
      await logFromUser(user, { action: "update", area: "Base de conhecimento", target: val.pagina.title });
      const { error } = await supabase.from("knowledge_pages").update(linha).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, id: b.id });
    }

    await logFromUser(user, { action: "create", area: "Base de conhecimento", target: val.pagina.title });
    const { data, error } = await supabase
      .from("knowledge_pages")
      .insert({ ...linha, owner_id: user.id })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: String(data.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/knowledge_/i.test(msg) && /does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0081_listas.sql." }, { status: 409 });
    }
    if (/value too long|22001/i.test(msg)) {
      return NextResponse.json({ error: `Conteúdo acima do limite (${MAX_CONTEUDO} caracteres).` }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
