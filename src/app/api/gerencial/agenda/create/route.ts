import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  clientId?: string;
  title?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  durationMin?: number;
  attendees?: string[];
  addMeet?: boolean;
  type?: string;
};

const MEETING_TYPES = new Set(["kickoff", "monthly", "violaunch", "media_day", "outro"]);

/**
 * Cria uma reunião no Google Calendar (com Meet) e registra em `meetings`,
 * para aparecer na aba Agenda do cliente. Gerencial-only.
 */
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

  const title = (b.title ?? "").trim();
  if (!b.clientId || !title || !b.date || !b.time) {
    return NextResponse.json({ error: "cliente, título, data e hora são obrigatórios" }, { status: 400 });
  }

  // Sao Paulo (UTC-3, sem horário de verão desde 2019).
  const start = new Date(`${b.date}T${b.time}:00-03:00`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "data/hora inválida" }, { status: 400 });
  }
  const durationMin = Number(b.durationMin) > 0 ? Number(b.durationMin) : 30;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const attendees = (b.attendees ?? []).map((e) => e.trim()).filter((e) => e.includes("@"));

  const result = await createEvent({
    summary: title,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    attendees,
    addMeet: b.addMeet !== false,
  });
  if (result.error || !result.event) {
    return NextResponse.json({ error: result.error ?? "Falha ao criar evento no Google." }, { status: 502 });
  }

  const joinUrl = result.event.hangoutLink ?? null;

  // Registra em meetings para a aba Agenda do cliente refletir.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.from("meetings").insert({
      client_id: b.clientId,
      title,
      starts_at: start.toISOString(),
      join_url: joinUrl,
      participants: attendees,
      type: b.type && MEETING_TYPES.has(b.type) ? b.type : "outro",
    });
  }

  return NextResponse.json({
    ok: true,
    joinUrl,
    htmlLink: result.event.htmlLink ?? null,
  });
}
