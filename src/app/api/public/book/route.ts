import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { slotsForDate, type AvailWindow } from "@/lib/data/agenda";
import { createEvent } from "@/lib/google/calendar";
import { logEvent } from "@/lib/audit/log";
import { trigger } from "@/lib/push/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";
const str = (v: unknown) => (v == null ? "" : String(v).trim());
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
/** Minutos do dia (fuso SP) de um instante ISO. */
function spMinutes(iso: string): number {
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
/** Data YYYY-MM-DD (fuso SP) de um instante (ou agora). */
function spDate(iso?: string): string {
  return new Date(iso ?? Date.now()).toLocaleDateString("en-CA", { timeZone: TZ });
}
const startOfDayIso = (date: string) => new Date(`${date}T00:00:00-03:00`).toISOString();
const endOfDayIso = (date: string) => new Date(`${date}T23:59:59-03:00`).toISOString();

/** Horários livres de um dia para o link (fuso SP). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = str(url.searchParams.get("slug"));
  const date = str(url.searchParams.get("date"));
  if (!slug || !date || !isSupabaseConfigured() || !hasServiceRole()) return json({ slots: [] });

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("scheduling_links")
    .select("owner_id, active, duration_min, buffer_min, availability")
    .eq("slug", slug)
    .maybeSingle();
  if (!link || !link.active) return json({ slots: [] });

  const avail = (Array.isArray(link.availability) ? link.availability : []) as AvailWindow[];
  const dur = Number(link.duration_min ?? 30);
  const buf = Number(link.buffer_min ?? 0);
  const candidates = slotsForDate(avail, dur, buf, date);

  const { data: evs } = await admin
    .from("calendar_events")
    .select("start_at,end_at")
    .eq("owner_id", link.owner_id)
    .gte("start_at", startOfDayIso(date))
    .lte("start_at", endOfDayIso(date));
  const busy = (evs ?? []).map((e) => {
    const s = spMinutes(String(e.start_at));
    const en = e.end_at ? spMinutes(String(e.end_at)) : s + dur;
    return [s, en] as [number, number];
  });

  const isToday = date === spDate();
  const nowMin = spMinutes(new Date().toISOString());
  const free = candidates.filter((hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    const start = h * 60 + m;
    const end = start + dur;
    if (isToday && start <= nowMin + 5) return false;
    return !busy.some(([bs, be]) => start < be && end > bs);
  });
  return json({ slots: free });
}

/** Agenda um horário: cria o evento na agenda do dono + notifica a equipe. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  const slug = str(b.slug);
  const date = str(b.date);
  const time = str(b.time);
  const name = str(b.name);
  const email = str(b.email);
  const phone = str(b.phone);
  if (str(b.website)) return json({ ok: true }); // honeypot
  if (!slug || !date || !time || !name) return json({ error: "preencha nome, data e horário" }, 400);
  if (!isSupabaseConfigured() || !hasServiceRole()) return json({ ok: true, persisted: false });

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("scheduling_links")
    .select("id, owner_id, label, active, duration_min, buffer_min, availability")
    .eq("slug", slug)
    .maybeSingle();
  if (!link || !link.active) return json({ error: "link indisponível" }, 404);

  const dur = Number(link.duration_min ?? 30);
  const buf = Number(link.buffer_min ?? 0);
  const avail = (Array.isArray(link.availability) ? link.availability : []) as AvailWindow[];
  if (!slotsForDate(avail, dur, buf, date).includes(time)) {
    return json({ error: "horário indisponível" }, 409);
  }

  const startIso = new Date(`${date}T${time}:00-03:00`).toISOString();
  const endIso = new Date(new Date(startIso).getTime() + dur * 60_000).toISOString();
  if (new Date(startIso).getTime() < Date.now()) return json({ error: "horário no passado" }, 409);

  // Conflito (alguém reservou nesse meio-tempo).
  const { data: evs } = await admin
    .from("calendar_events")
    .select("start_at,end_at")
    .eq("owner_id", link.owner_id)
    .gte("start_at", startOfDayIso(date))
    .lte("start_at", endOfDayIso(date));
  const ns = new Date(startIso).getTime();
  const ne = new Date(endIso).getTime();
  const conflict = (evs ?? []).some((e) => {
    const s = new Date(String(e.start_at)).getTime();
    const en = e.end_at ? new Date(String(e.end_at)).getTime() : s + dur * 60_000;
    return ns < en && ne > s;
  });
  if (conflict) return json({ error: "esse horário acabou de ser reservado — escolha outro" }, 409);

  const { data: ins, error } = await admin
    .from("calendar_events")
    .insert({
      owner_id: link.owner_id,
      title: `${link.label}: ${name}`,
      type: "meeting",
      start_at: startIso,
      end_at: endIso,
    })
    .select("id")
    .single();
  if (error) return json({ error: "falha ao agendar" }, 500);

  // Google Calendar (best-effort): cria o evento com Meet + convida o lead.
  // Guarda o id/meet no evento local (dedupe na agenda + exibe o Meet).
  let meetLink: string | undefined;
  try {
    const desc = [email && `E-mail: ${email}`, phone && `WhatsApp: ${phone}`].filter(Boolean).join("\n");
    const gr = await createEvent({
      summary: `${link.label}: ${name}`,
      description: desc || undefined,
      startIso,
      endIso,
      attendees: email ? [email] : [],
      addMeet: true,
    });
    if (gr.event?.id) {
      meetLink = gr.event.hangoutLink;
      await admin.from("calendar_events").update({ google_event_id: gr.event.id, meet_link: meetLink ?? null }).eq("id", ins.id);
    }
  } catch {
    /* Google não conectado / falhou — segue com o evento local. */
  }

  const when = new Date(startIso).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
  await trigger.bookingCreated({ label: String(link.label), name, email, when }).catch(() => {});
  await logEvent({
    userName: name,
    userEmail: email || null,
    panel: "gerencial",
    action: "create",
    area: "Agenda",
    target: String(link.id),
    detail: `Agendou "${link.label}" em ${when}${phone ? ` · ${phone}` : ""}`,
    meta: { email, phone },
  });

  return json({ ok: true, when, meetLink });
}
