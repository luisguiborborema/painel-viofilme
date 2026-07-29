import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  command?: string;
  title?: string;
  hint?: string;
  stageHint?: string;
  body?: string;
  isActive?: boolean;
  position?: number;
};

/** CRUD da biblioteca de scripts/roteiros (crm_scripts). */
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

  const action = b.action ?? (b.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_scripts").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Normaliza o comando: sempre começa com "/" quando informado.
  const command =
    b.command != null
      ? b.command.trim()
        ? `/${b.command.trim().replace(/^\/+/, "")}`
        : null
      : undefined;

  if (action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: now };
    if (b.title != null) patch.title = b.title.trim();
    if (command !== undefined) patch.command = command;
    if (b.hint != null) patch.hint = b.hint.trim() || null;
    if (b.stageHint != null) patch.stage_hint = b.stageHint || null;
    if (b.body != null) patch.body = b.body;
    if (b.isActive != null) patch.is_active = b.isActive;
    if (b.position != null) patch.position = b.position;
    const { error } = await supabase.from("crm_scripts").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  if (!b.title?.trim() || !b.body?.trim()) {
    return NextResponse.json({ error: "título e corpo são obrigatórios" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("crm_scripts")
    .insert({
      command: command ?? null,
      title: b.title.trim(),
      hint: b.hint?.trim() || null,
      stage_hint: b.stageHint || null,
      body: b.body,
      position: b.position ?? 99,
      is_active: b.isActive ?? true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
