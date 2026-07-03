import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { getReportSends } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** REL06 — histórico de envios (relatórios manuais + updates automáticos). */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const sends = await getReportSends();
  return NextResponse.json({ sends });
}

/**
 * REL05 — envio MANUAL do relatório por WhatsApp (o analista decide quando).
 * Manda um aviso ao WhatsApp do cliente e registra em report_sends (REL06).
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { clientId?: string; period?: string; message?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name,whatsapp")
    .eq("id", b.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  const phone = String(client.whatsapp ?? "");
  if (!phone) {
    return NextResponse.json(
      { error: "cliente sem WhatsApp cadastrado (defina em Clientes → Configuração)" },
      { status: 400 },
    );
  }

  const message =
    b.message?.trim() ||
    `Olá! 📊 O relatório de resultados de ${client.name}${b.period ? ` — ${b.period}` : ""} está pronto. Qualquer dúvida, é só chamar!`;

  let sent = false;
  if (isWhatsappConfigured()) sent = await sendWhatsappText(phone, message);

  await supabase.from("report_sends").insert({
    client_id: b.clientId,
    kind: "report",
    channel: "whatsapp",
    recipient: phone,
    sent_by: user.name,
    detail: b.period ? `Relatório ${b.period}` : "Relatório",
  });

  return NextResponse.json({ ok: true, persisted: true, sent });
}
