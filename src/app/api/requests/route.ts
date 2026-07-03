import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { trigger } from "@/lib/push/triggers";
import { isGoogleConfigured } from "@/lib/google/config";
import { createEvent } from "@/lib/google/calendar";

/**
 * Solicitações do portal do cliente (R09 reunião · C02 conteúdo).
 *
 * A rota valida o payload e dispara a notificação push para a equipe gerencial.
 * A persistência em `meeting_requests` / `content_requests` (ver
 * 0002_portal_v2.sql) entra quando ligarmos os formulários ao banco.
 */
type RequestType = "meeting" | "content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { type?: RequestType; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const type = body.type;
  if (type !== "meeting" && type !== "content") {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  const user = await getSession();
  const clientId = user?.clientId ?? null;
  const clientName = user?.clientName ?? user?.name ?? "Um cliente";

  // Gatilho: notifica a equipe gerencial (push + WhatsApp).
  if (type === "meeting") {
    await trigger.requestMeeting(clientId, clientName);
  } else {
    await trigger.requestContent(clientId, clientName);
  }

  // Solicitação de reunião → cria evento "[A confirmar]" no Google (best-effort).
  let event: { htmlLink?: string; hangoutLink?: string } | null = null;
  if (type === "meeting" && isGoogleConfigured()) {
    const p = (body.payload ?? {}) as {
      subject?: string;
      detail?: string;
      area?: string;
      urgency?: string;
      slot?: string;
    };
    // Placeholder: amanhã 13:00 UTC (~10:00 BRT). A equipe reagenda no horário real.
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(13, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const r = await createEvent({
      summary: `[A confirmar] ${p.subject ?? "Reunião"} — ${clientName}`,
      description: [
        `Solicitação de reunião pelo portal do cliente.`,
        p.area && `Área: ${p.area}`,
        p.urgency && `Urgência: ${p.urgency}`,
        p.slot && `Horário preferido do cliente: ${p.slot}`,
        p.detail && `\n${p.detail}`,
        `\n⚠ Reagende este evento para o horário combinado.`,
      ]
        .filter(Boolean)
        .join("\n"),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      addMeet: true,
    });
    event = r.event ?? null;
  }

  const id = `req-${type}-${clientId ?? "anon"}-${Math.round(performance.now())}`;
  return NextResponse.json({ ok: true, id, persisted: false, event });
}
