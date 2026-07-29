import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hasFullAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE: Record<string, string> = {
  loss: "crm_lost_reasons",
  freeze: "crm_freeze_reasons",
};

type Body = {
  action?: "create" | "update" | "delete";
  kind?: "loss" | "freeze";
  id?: string;
  label?: string;
  position?: number;
};

/** CRUD dos motivos de perda e de congelamento (config estrutural → só gestor). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  // Config estrutural: apenas gestor/C-level.
  if (!hasFullAccess(user.allowedSections ?? null)) {
    return NextResponse.json({ error: "somente gestor pode editar motivos" }, { status: 403 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const table = b.kind ? TABLE[b.kind] : undefined;
  if (!table) return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from(table).delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.label != null) patch.label = b.label.trim();
    if (b.position != null) patch.position = b.position;
    const { error } = await supabase.from(table).update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.label?.trim()) return NextResponse.json({ error: "rótulo ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from(table)
    .insert({ label: b.label.trim(), position: b.position ?? 99 })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
