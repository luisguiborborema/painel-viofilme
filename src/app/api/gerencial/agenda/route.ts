import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "approve-request" | "decline-request" | "set-notes";
  requestId?: string;
  meetingId?: string;
  clientId?: string;
  title?: string;
  startIso?: string;
  durationMin?: number;
  attendees?: string[];
  addMeet?: boolean;
  agenda?: string;
  nextSteps?: string;
  shared?: boolean;
};

/** Ações da Agenda do cliente (gerencial): aprovar solicitação, pauta/ata. */
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
  const action = b.action ?? "set-notes";

  if (action === "decline-request") {
    if (!b.requestId) return NextResponse.json({ error: "requestId ausente" }, { status: 400 });
    const { error } = await supabase.from("meeting_requests").update({ status: "declined" }).eq("id", b.requestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-notes") {
    if (!b.meetingId) return NextResponse.json({ error: "meetingId ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.agenda !== undefined) {
      patch.agenda = b.agenda.trim() || null;
      if (b.shared !== undefined) patch.agenda_shared = !!b.shared;
    }
    if (b.nextSteps !== undefined) {
      patch.next_steps = b.nextSteps.trim() || null;
      if (b.shared !== undefined) patch.next_steps_shared = !!b.shared;
    }
    const { error } = await supabase.from("meetings").update(patch).eq("id", b.meetingId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // approve-request: cria o evento no Google, grava em meetings, marca agendada.
  const title = (b.title ?? "").trim();
  if (!b.clientId || !b.requestId || !title || !b.startIso) {
    return NextResponse.json({ error: "cliente, solicitação, título e início obrigatórios" }, { status: 400 });
  }
  const start = new Date(b.startIso);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "início inválido" }, { status: 400 });
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

  await supabase.from("meetings").insert({
    client_id: b.clientId,
    title,
    starts_at: start.toISOString(),
    join_url: joinUrl,
    participants: attendees,
  });
  await supabase.from("meeting_requests").update({ status: "scheduled" }).eq("id", b.requestId);

  return NextResponse.json({ ok: true, persisted: true, joinUrl });
}
