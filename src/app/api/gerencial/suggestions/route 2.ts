import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { SUGGESTION_STATUS_KEYS } from "@/lib/data/suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Attachment = { url?: string; type?: string; name?: string };
type Body = {
  action?: "create" | "set-status" | "delete";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  attachments?: Attachment[];
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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
  const action = b.action ?? "create";

  if (action === "set-status") {
    if (!b.id || !SUGGESTION_STATUS_KEYS.includes(str(b.status))) {
      return NextResponse.json({ error: "id/status inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("suggestions")
      .update({ status: str(b.status), updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    // Autor apaga a própria; admin apaga qualquer uma.
    const { data: s } = await supabase.from("suggestions").select("author_id").eq("id", b.id).maybeSingle();
    if (s && s.author_id && s.author_id !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "só o autor ou admin pode excluir" }, { status: 403 });
    }
    const { error } = await supabase.from("suggestions").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logFromUser(user, { action: "delete", area: "Sugestões", target: b.id });
    return NextResponse.json({ ok: true });
  }

  // create
  const title = str(b.title);
  if (!title) return NextResponse.json({ error: "título ausente" }, { status: 400 });
  const attachments = (Array.isArray(b.attachments) ? b.attachments : [])
    .filter((a) => str(a?.url))
    .slice(0, 12)
    .map((a) => ({
      url: str(a.url),
      type: a.type === "image" || a.type === "video" ? a.type : "file",
      name: str(a.name) || "arquivo",
    }));

  const { data, error } = await supabase
    .from("suggestions")
    .insert({
      author_id: user.id,
      author_name: user.name,
      title: title.slice(0, 200),
      description: str(b.description) || null,
      status: "aberta",
      attachments,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logFromUser(user, { action: "create", area: "Sugestões", target: title });
  return NextResponse.json({ ok: true, id: data.id });
}
