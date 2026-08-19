import { NextResponse } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendWhatsappText } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

/**
 * Pesquisa pós-reunião automática: para reuniões da Agenda (calendar_events com
 * cliente) que terminaram há ~N horas (N = meeting_survey_config.delay_hours),
 * cria o convite e envia o link no WhatsApp. Roda de hora em hora; a config
 * decide se está ligado e o atraso. Autoriza via CRON_SECRET.
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
  const { data: cfg } = await admin
    .from("meeting_survey_config")
    .select("auto_enabled, delay_hours")
    .eq("id", 1)
    .maybeSingle();
  if (!cfg?.auto_enabled) return NextResponse.json({ ok: true, skipped: "auto desligado" });

  const n = Math.max(0, Math.min(Number(cfg.delay_hours) || 2, 168));
  const now = Date.now();
  // Cron roda 1×/dia (limite do plano Hobby). Captamos reuniões cujo "horário de
  // envio" (fim + N horas) já passou, olhando ~2 dias para trás. O dedup por
  // meeting_ref garante que cada reunião recebe a pesquisa uma única vez.
  const windowEnd = new Date(now - n * HOUR).toISOString(); // terminou até N horas atrás
  const windowStart = new Date(now - (n + 48) * HOUR).toISOString(); // ...dentro dos últimos ~2 dias
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const { data: events } = await admin
    .from("calendar_events")
    .select("id, client_id, end_at, clients(name, slug, whatsapp)")
    .not("client_id", "is", null)
    .not("end_at", "is", null)
    .gte("end_at", windowStart)
    .lt("end_at", windowEnd);

  const rows = (events ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return NextResponse.json({ ok: true, created: 0, sent: 0 });

  // Deduplica: pula reuniões que já têm pesquisa (meeting_ref = id da reunião).
  const ids = rows.map((r) => String(r.id));
  const { data: existing } = await admin.from("meeting_surveys").select("meeting_ref").in("meeting_ref", ids);
  const done = new Set((existing ?? []).map((s) => String((s as { meeting_ref?: unknown }).meeting_ref)));

  let created = 0;
  let sent = 0;
  for (const r of rows) {
    const eventId = String(r.id);
    if (done.has(eventId)) continue;
    const c = r.clients as { name?: string; slug?: string; whatsapp?: string } | { name?: string; slug?: string; whatsapp?: string }[] | null;
    const client = Array.isArray(c) ? c[0] : c;
    const wa = String(client?.whatsapp ?? "").replace(/\D/g, "");
    if (wa.length < 10) continue;

    const { data: inv } = await admin
      .from("meeting_surveys")
      .insert({ client_id: r.client_id, status: "pending", channel: "whatsapp", meeting_ref: eventId, sent_at: new Date().toISOString() })
      .select("public_token")
      .single();
    if (!inv?.public_token) continue;
    created += 1;
    const slug = String(client?.slug ?? "").trim() || "cliente";
    const link = `${base}/pesquisa/${slug}/${inv.public_token}`;
    const msg = `Oi! Aqui é da Viofilme 💙 Como foi nossa reunião? Responda rapidinho nossa pesquisa (leva menos de 1 minuto): ${link}`;
    const ok = await sendWhatsappText(wa, msg).catch(() => false);
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, created, sent });
}
