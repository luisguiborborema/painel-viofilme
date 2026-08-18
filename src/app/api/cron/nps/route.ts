import { NextResponse } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendWhatsappText } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const NPS_INTERVAL = 90 * DAY; // trimestral
const RECENT_INVITE = 30 * DAY; // não convida de novo se convidou nos últimos 30 dias

/**
 * NPS automático trimestral: para cada cliente com WhatsApp, se faz ≥90 dias
 * desde a última resposta (ou nunca respondeu) e não houve convite recente,
 * cria um convite com link público e envia no WhatsApp. Roda diário; a
 * elegibilidade (90 dias) é checada por cliente. Autoriza via CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const now = Date.now();

  const [{ data: clients }, { data: surveys }] = await Promise.all([
    admin.from("clients").select("id, name, whatsapp").not("whatsapp", "is", null),
    admin.from("nps_surveys").select("client_id, status, score, created_at, sent_at, answered_at"),
  ]);

  // Última resposta e último convite por cliente.
  const byClient = new Map<string, { lastAnswered: number; lastSent: number }>();
  for (const s of surveys ?? []) {
    const cid = String(s.client_id);
    const rec = byClient.get(cid) ?? { lastAnswered: 0, lastSent: 0 };
    const ansIso = (s.answered_at as string) ?? (s.score != null ? (s.created_at as string) : null);
    if (ansIso) rec.lastAnswered = Math.max(rec.lastAnswered, Date.parse(ansIso));
    const sentIso = (s.sent_at as string) ?? (s.created_at as string);
    if (s.status === "pending" && sentIso) rec.lastSent = Math.max(rec.lastSent, Date.parse(sentIso));
    byClient.set(cid, rec);
  }

  let created = 0;
  let sent = 0;
  for (const c of clients ?? []) {
    const wa = String(c.whatsapp ?? "").replace(/\D/g, "");
    if (wa.length < 10) continue;
    const rec = byClient.get(String(c.id)) ?? { lastAnswered: 0, lastSent: 0 };
    if (now - rec.lastAnswered < NPS_INTERVAL) continue; // respondeu há < 90 dias
    if (now - rec.lastSent < RECENT_INVITE) continue; // convite recente pendente

    const { data: inv } = await admin
      .from("nps_surveys")
      .insert({ client_id: c.id, status: "pending", channel: "whatsapp", sent_at: new Date().toISOString() })
      .select("public_token")
      .single();
    if (!inv?.public_token) continue;
    created += 1;
    const link = `${base}/nps/${inv.public_token}`;
    const msg = `Oi! Aqui é da Viofilme 💚 Sua opinião é muito importante pra gente. Pode responder nossa pesquisa rápida de satisfação? Leva menos de 1 minuto: ${link}`;
    const ok = await sendWhatsappText(wa, msg).catch(() => false);
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, created, sent });
}
