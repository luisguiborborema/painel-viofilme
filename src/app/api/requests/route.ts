import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { trigger } from "@/lib/push/triggers";
import { notifyManagementInApp } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/lib/google/config";
import { createEvent } from "@/lib/google/calendar";

/**
 * Solicitações do portal do cliente (R09 reunião · C02 conteúdo).
 * Persiste em `meeting_requests` / `content_requests`, notifica a equipe
 * (push + WhatsApp + in-app) e, para reunião, cria um evento "[A confirmar]".
 */
type RequestType = "meeting" | "content";

const MEDIA_TYPES = ["image", "video", "carousel", "reel", "story"];
const NETWORKS = ["instagram", "facebook"];

function mapUrgency(u?: string): "normal" | "urgent" {
  return u === "urgent" || u === "urgente" || u === "alta" ? "urgent" : "normal";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { type?: RequestType; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const type = body.type;
  if (type !== "meeting" && type !== "content") {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  const p = (body.payload ?? {}) as Record<string, unknown>;
  const str = (k: string) => (p[k] == null ? undefined : String(p[k]));

  const user = await getSession();
  const clientId = user?.clientId ?? null;
  const clientName = user?.clientName ?? user?.name ?? "Um cliente";
  const subject = str("subject") || (type === "meeting" ? "Reunião" : "Conteúdo");

  // 1) Persiste a solicitação (RLS: o cliente cria a própria).
  let persisted = false;
  if (isSupabaseConfigured() && clientId && user) {
    const supabase = await createClient();
    if (type === "meeting") {
      const notes = [
        str("detail"),
        str("area") && `Área: ${str("area")}`,
        str("slot") && `Horário preferido: ${str("slot")}`,
      ]
        .filter(Boolean)
        .join("\n");
      const { error } = await supabase.from("meeting_requests").insert({
        client_id: clientId,
        requested_by: user.id,
        subject,
        notes: notes || null,
        urgency: mapUrgency(str("urgency")),
      });
      persisted = !error;
    } else {
      const format = MEDIA_TYPES.includes(str("format") ?? "") ? str("format") : "image";
      const nets = (Array.isArray(p.networks) ? (p.networks as string[]) : []).filter((n) =>
        NETWORKS.includes(n),
      );
      const date = str("date");
      const refs = Array.isArray(p.references) ? (p.references as string[]).filter(Boolean) : [];
      const { error } = await supabase.from("content_requests").insert({
        client_id: clientId,
        requested_by: user.id,
        format,
        networks: nets.length ? nets : ["instagram"],
        desired_date: date && !Number.isNaN(Date.parse(date)) ? date : null,
        desired_time: str("time") || null,
        subject,
        description: str("description") || null,
        guideline: str("guideline") || null,
        reference_urls: refs,
        urgency: mapUrgency(str("urgency")),
      });
      persisted = !error;
    }
  }

  // 2) Notifica a equipe: push + WhatsApp (trigger) e in-app (sininho).
  if (type === "meeting") await trigger.requestMeeting(clientId, clientName);
  else await trigger.requestContent(clientId, clientName);
  await notifyManagementInApp({
    title: type === "meeting" ? "Nova solicitação de reunião" : "Nova solicitação de conteúdo",
    body: `${clientName}: ${subject}`,
    url: type === "meeting" ? "/gerencial/agenda" : "/gerencial/conteudo",
  });

  // 3) Reunião → evento "[A confirmar]" no Google (best-effort).
  let event: { htmlLink?: string; hangoutLink?: string } | null = null;
  if (type === "meeting" && isGoogleConfigured()) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(13, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const r = await createEvent({
      summary: `[A confirmar] ${subject} — ${clientName}`,
      description: [
        `Solicitação de reunião pelo portal do cliente.`,
        str("area") && `Área: ${str("area")}`,
        str("urgency") && `Urgência: ${str("urgency")}`,
        str("slot") && `Horário preferido do cliente: ${str("slot")}`,
        str("detail") && `\n${str("detail")}`,
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

  return NextResponse.json({ ok: true, persisted, event });
}
