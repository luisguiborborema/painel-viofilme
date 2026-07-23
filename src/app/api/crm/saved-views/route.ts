import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cond = { field?: string; op?: string; value?: string };
type Body = {
  action?: "create" | "delete";
  id?: string;
  scope?: string;
  name?: string;
  conditions?: Cond[];
  lens?: string | null;
  isShared?: boolean;
};

/** CRUD das visões salvas (filtros nomeados de Pessoas/Empresas). */
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

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("saved_views").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  const scope = b.scope === "empresas" ? "empresas" : "pessoas";
  if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  const conditions = (b.conditions ?? [])
    .filter((c) => c.field && c.op)
    .map((c) => ({ field: String(c.field), op: String(c.op), value: String(c.value ?? "") }));
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      owner_id: user.id,
      scope,
      name: b.name.trim(),
      conditions,
      lens: b.lens ?? null,
      is_shared: Boolean(b.isShared),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
