import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "invite" | "delete";
  id?: string;
  clientId?: string;
  channel?: string;
  meetingRef?: string;
};

/** Pesquisa pós-reunião (gerencial): gera convite/link, exclui resposta. */
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
    const { error } = await supabase.from("meeting_surveys").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // invite
  const clientId = (b.clientId ?? "").trim();
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  const channel = ["whatsapp", "email", "manual"].includes(String(b.channel)) ? b.channel : "manual";
  const { data, error } = await supabase
    .from("meeting_surveys")
    .insert({ client_id: clientId, status: "pending", channel, meeting_ref: b.meetingRef?.trim() || null, sent_at: new Date().toISOString(), created_by: user.id })
    .select("id, public_token")
    .single();
  if (error) {
    if (/meeting_surveys.* does not exist|42P01/i.test(error.message)) {
      return NextResponse.json(
        { error: "Recurso ainda não ativado. Rode a migração 0119_meeting_surveys.sql." },
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
