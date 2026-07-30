import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Avail = { day: number; start: string; end: string };
type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  url?: string;
  label?: string;
  active?: boolean;
  native?: boolean;
  durationMin?: number;
  bufferMin?: number;
  daysAhead?: number;
  availability?: Avail[];
};

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agenda"
  );
}
function cleanAvail(a?: Avail[]): Avail[] {
  return (a ?? [])
    .filter((w) => w && typeof w.day === "number" && /^\d{1,2}:\d{2}$/.test(String(w.start)) && /^\d{1,2}:\d{2}$/.test(String(w.end)))
    .map((w) => ({ day: Math.max(0, Math.min(6, Number(w.day))), start: String(w.start), end: String(w.end) }));
}
const clampDur = (n: number) => Math.max(5, Math.min(480, Number(n)));
const clampBuf = (n: number) => Math.max(0, Math.min(120, Number(n)));
const clampAhead = (n: number) => Math.max(1, Math.min(90, Number(n)));

/** CRUD dos links de agendamento (externos ou nativos Calendly-like) do usuário. */
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

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("scheduling_links").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.url !== undefined) patch.url = b.url?.trim() || null;
    if (b.label != null) patch.label = b.label.trim();
    if (b.active != null) patch.active = b.active;
    if (b.durationMin != null) patch.duration_min = clampDur(b.durationMin);
    if (b.bufferMin != null) patch.buffer_min = clampBuf(b.bufferMin);
    if (b.daysAhead != null) patch.days_ahead = clampAhead(b.daysAhead);
    if (b.availability !== undefined) patch.availability = cleanAvail(b.availability);
    const { error } = await supabase.from("scheduling_links").update(patch).eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  const label = b.label?.trim() || "Agendar comigo";
  if (b.native) {
    let slug = slugify(label);
    const { data: all } = await supabase.from("scheduling_links").select("slug");
    const taken = new Set((all ?? []).map((r) => (r.slug ? String(r.slug) : "")).filter(Boolean));
    const base = slug;
    let i = 2;
    while (taken.has(slug)) slug = `${base}-${i++}`;
    const { data, error } = await supabase
      .from("scheduling_links")
      .insert({
        owner_id: user.id,
        label,
        active: true,
        slug,
        url: null,
        duration_min: b.durationMin ? clampDur(b.durationMin) : 30,
        buffer_min: b.bufferMin ? clampBuf(b.bufferMin) : 0,
        days_ahead: b.daysAhead ? clampAhead(b.daysAhead) : 14,
        availability: cleanAvail(b.availability),
      })
      .select("id, slug")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
  }

  if (!b.url?.trim()) return NextResponse.json({ error: "url ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from("scheduling_links")
    .insert({ owner_id: user.id, url: b.url.trim(), label, active: true })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
