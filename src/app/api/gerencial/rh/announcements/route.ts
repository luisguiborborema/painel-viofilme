import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete";
  id?: string;
  category?: string;
  content?: string;
  authorRole?: string;
};

const CATS = new Set(["operational", "culture", "career"]);

/** RH — Mural (comunicados internos). Só gerencial. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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

  try {
    if (b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("rh_announcements").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (!b.content?.trim()) return NextResponse.json({ error: "conteúdo obrigatório" }, { status: 400 });
    const { data, error } = await supabase
      .from("rh_announcements")
      .insert({
        author: user.name,
        author_role: b.authorRole?.trim() || "Gerencial",
        category: CATS.has(String(b.category)) ? b.category : "operational",
        content: b.content.trim(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/rh_announcements.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela do mural ainda não existe. Rode a migração 0112_rh_mural.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
