import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "delete" | "invite";
  id?: string;
  clientId?: string;
  score?: number;
  comment?: string;
  respondent?: string;
  channel?: string;
};

/** Pesquisas de NPS por cliente (gerencial). Registro manual pelo CS. */
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
  const action = b.action ?? "create";

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("nps_surveys").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // invite: cria um convite pendente (sem nota) e devolve o token + contato
  // do cliente para o botão montar o link (WhatsApp / e-mail / copiar).
  if (action === "invite") {
    const clientId = (b.clientId ?? "").trim();
    if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
    const channel = ["whatsapp", "email", "manual"].includes(String(b.channel)) ? b.channel : "manual";
    const { data, error } = await supabase
      .from("nps_surveys")
      .insert({ client_id: clientId, status: "pending", channel, sent_at: new Date().toISOString(), created_by: user.id })
      .select("id, public_token")
      .single();
    if (error) {
      if (/public_token|status|42703|column .* does not exist/i.test(error.message)) {
        return NextResponse.json(
          { error: "Recurso de NPS por link ainda não ativado. Rode a migração 0116_nps_invites.sql." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: c } = await supabase
      .from("clients")
      .select("name, slug, whatsapp, contact_email")
      .eq("id", clientId)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      id: data.id,
      token: data.public_token,
      clientName: c?.name ?? "",
      slug: c?.slug ?? "",
      whatsapp: c?.whatsapp ?? "",
      email: c?.contact_email ?? "",
    });
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
