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
  display?: unknown;
};

/** CRUD das visões salvas (filtros nomeados de Pessoas/Empresas). */
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

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("saved_views").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  const scope = ["pessoas", "empresas", "negocios"].includes(b.scope ?? "") ? (b.scope as string) : "pessoas";
  if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  const conditions = (b.conditions ?? [])
    .filter((c) => c.field && c.op)
    .map((c) => ({ field: String(c.field), op: String(c.op), value: String(c.value ?? "") }));
  const base = {
    owner_id: user.id,
    scope,
    name: b.name.trim(),
    conditions,
    lens: b.lens ?? null,
    is_shared: Boolean(b.isShared),
  };
  const display = b.display && typeof b.display === "object" ? b.display : {};
  // Tenta gravar com `display` (coluna nova, migração 0102); se a coluna ainda
  // não existir (42703), grava sem ela — a visão é salva mesmo sem a migração.
  let res = await supabase.from("saved_views").insert({ ...base, display }).select("id").single();
  if (res.error?.code === "42703") {
    res = await supabase.from("saved_views").insert(base).select("id").single();
  }
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: res.data.id });
}
