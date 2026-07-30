import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Views salvas do Painel de Entregas — conjuntos nomeados de filtros por
 * usuário. Reaproveita a tabela saved_views (scope="entregas"), guardando o
 * objeto de filtros no jsonb `conditions`.
 */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ views: [] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_views")
    .select("id, name, conditions")
    .eq("scope", "entregas")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  const views = (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    filters: (r.conditions && typeof r.conditions === "object" ? r.conditions : {}) as Record<string, unknown>,
  }));
  return NextResponse.json({ views });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { action?: "create" | "delete"; id?: string; name?: string; filters?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("saved_views").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const name = b.name?.trim();
  if (!name) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      owner_id: user.id,
      scope: "entregas",
      name,
      conditions: b.filters && typeof b.filters === "object" ? b.filters : {},
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, name });
}
