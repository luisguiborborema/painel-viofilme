import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ICONS = new Set(["meta", "google", "rd", "wordpress", "ecommerce", "other"]);
const STATUS = new Set(["connected", "review", "soon", "setup"]);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Body = {
  action?: "create" | "update" | "delete";
  clientId?: string;
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  status?: string;
  note?: string;
  url?: string;
};

function toFields(b: Body): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (b.name !== undefined && b.name.trim()) f.name = b.name.trim();
  if ("description" in b) f.description = clean(b.description);
  if ("icon" in b) f.icon = ICONS.has(String(b.icon)) ? b.icon : "other";
  if ("status" in b) f.status = STATUS.has(String(b.status)) ? b.status : "connected";
  if ("note" in b) f.note = clean(b.note);
  if ("url" in b) f.url = clean(b.url);
  return f;
}

/** GET: lista os acessos de um cliente (gerencial). */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ accesses: [] });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_accesses")
    .select("id, name, description, icon, status, note, url, position")
    .eq("client_id", clientId)
    .order("position", { ascending: true });
  if (error) return NextResponse.json({ accesses: [] });
  return NextResponse.json({ accesses: data ?? [] });
}

/** POST: cria/edita/exclui acesso (gerencial). */
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
      const { error } = await supabase.from("client_accesses").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (b.action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch = toFields(b);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("client_accesses").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!b.clientId || !b.name?.trim()) {
      return NextResponse.json({ error: "cliente e nome são obrigatórios" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("client_accesses")
      .insert({ client_id: b.clientId, ...toFields(b) })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/client_accesses.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela de acessos ainda não existe. Rode a migração 0114_client_accesses.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
