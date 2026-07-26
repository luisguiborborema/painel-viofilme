import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createEvent, updateEvent, deleteEvent } from "@/lib/google/calendar";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["meeting", "call", "other"]);

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  title?: string;
  type?: string;
  startAt?: string;
  endAt?: string;
  dealId?: string;
  /** Origem do evento sendo editado/apagado: "google" (real) ou "own" (local). */
  source?: "own" | "google";
  /** Calendário do Google onde o evento vive (edição/exclusão no lugar certo). */
  calendarId?: string;
  // Reunião real no Google Calendar (Meet + convidados + descrição).
  useGoogle?: boolean;
  description?: string;
  attendees?: string[];
  addMeet?: boolean;
};

function cleanEmails(list?: string[]): string[] {
  return (list ?? []).map((a) => a.trim()).filter((a) => a.includes("@"));
}

/** CRUD dos eventos próprios (fallback/complemento ao Google Calendar). */
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
  await logFromUser(user, { action: b.action ?? "create", area: "Agenda", target: b.title ?? b.id ?? null });

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    if (b.source === "google") {
      const r = await deleteEvent(b.id, b.calendarId);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      return NextResponse.json({ ok: true, google: true });
    }
    const { error } = await supabase.from("calendar_events").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    if (b.source === "google") {
      const result = await updateEvent(b.id, {
        summary: b.title?.trim(),
        description: b.description ?? "",
        startIso: b.startAt,
        endIso: b.endAt,
        attendees: cleanEmails(b.attendees),
        addMeet: b.addMeet,
        calendarId: b.calendarId,
      });
      if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
      return NextResponse.json({
        ok: true,
        google: true,
        meetLink: result.event?.hangoutLink,
        htmlLink: result.event?.htmlLink,
      });
    }
    const patch: Record<string, unknown> = {};
    if (b.title != null) patch.title = b.title.trim();
    if (b.type != null && TYPES.has(b.type)) patch.type = b.type;
    if (b.startAt != null) patch.start_at = b.startAt;
    if (b.endAt !== undefined) patch.end_at = b.endAt ?? null;
    const { error } = await supabase.from("calendar_events").update(patch).eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.title?.trim() || !b.startAt) {
    return NextResponse.json({ error: "título/início ausentes" }, { status: 400 });
  }

  // Reunião no Google: cria evento real (Meet + convidados + descrição) e envia
  // convites. Não grava local (aparece via listUpcomingEvents na próxima carga).
  if (b.useGoogle) {
    const attendees = (b.attendees ?? [])
      .map((a) => a.trim())
      .filter((a) => a.includes("@"));
    const result = await createEvent({
      summary: b.title.trim(),
      description: b.description || undefined,
      startIso: b.startAt,
      endIso: b.endAt ?? new Date(new Date(b.startAt).getTime() + 60 * 60 * 1000).toISOString(),
      attendees,
      addMeet: b.addMeet !== false,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({
      ok: true,
      google: true,
      meetLink: result.event?.hangoutLink,
      htmlLink: result.event?.htmlLink,
    });
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      owner_id: user.id,
      title: b.title.trim(),
      type: b.type && TYPES.has(b.type) ? b.type : "meeting",
      start_at: b.startAt,
      end_at: b.endAt ?? null,
      deal_id: b.dealId ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
