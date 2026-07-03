import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agenda uma reunião com o lead: cria o evento no Google (com Meet), move o
 * lead para "reunião marcada", registra a tarefa e a interação.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let b: {
    leadId?: string;
    summary?: string;
    startIso?: string;
    durationMin?: number;
    description?: string;
    attendees?: string[];
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.leadId || !b.startIso) {
    return NextResponse.json({ error: "leadId/startIso ausente" }, { status: 400 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google não configurado" }, { status: 503 });
  }

  const start = new Date(b.startIso);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "data inválida" }, { status: 400 });
  }
  const end = new Date(start.getTime() + (b.durationMin ?? 30) * 60_000);

  const result = await createEvent({
    summary: b.summary?.trim() || "Reunião",
    description: b.description,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    attendees: b.attendees,
    addMeet: true,
  });
  if (!result.event) {
    return NextResponse.json(
      { error: result.error ?? "não foi possível criar o evento (reconecte o Google em Integrações)" },
      { status: 502 },
    );
  }
  const event = result.event;

  // Persiste no CRM (quando há banco): move estágio, tarefa e timeline.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const now = new Date().toISOString();
    await supabase
      .from("crm_leads")
      .update({
        stage: "reuniao",
        stage_changed_at: now,
        next_task_title: b.summary?.trim() || "Reunião",
        next_task_due: start.toISOString(),
        updated_at: now,
      })
      .eq("id", b.leadId);
    await supabase.from("crm_tasks").insert({
      lead_id: b.leadId,
      title: `Reunião — ${b.summary?.trim() || "com o lead"}`,
      due_date: start.toISOString(),
    });
    await supabase.from("crm_interactions").insert({
      lead_id: b.leadId,
      channel: "system",
      body: `📅 Reunião agendada no Google Agenda.${event.hangoutLink ? `\nMeet: ${event.hangoutLink}` : ""}`,
      author: user.name,
      meta: { eventId: event.id, hangoutLink: event.hangoutLink, htmlLink: event.htmlLink },
    });
  }

  return NextResponse.json({ ok: true, event });
}
