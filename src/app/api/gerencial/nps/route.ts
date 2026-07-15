import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete";
  id?: string;
  clientId?: string;
  score?: number;
  comment?: string;
  respondent?: string;
};

/** Pesquisas de NPS por cliente (gerencial). Registro manual pelo CS. */
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
  const action = b.action ?? "create";

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("nps_surveys").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  const clientId = (b.clientId ?? "").trim();
  const score = Number(b.score);
  if (!clientId || !Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json(
      { error: "cliente e nota (0–10) são obrigatórios" },
      { status: 400 },
    );
  }
  const { data, error } = await supabase
    .from("nps_surveys")
    .insert({
      client_id: clientId,
      score,
      comment: b.comment?.trim() || null,
      respondent: b.respondent?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
