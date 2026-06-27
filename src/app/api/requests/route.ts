import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Solicitações do portal do cliente (R09 reunião · C02 conteúdo).
 *
 * Modo híbrido: a rota já existe e valida o payload, mas ainda NÃO grava no
 * Supabase. Quando o banco for provisionado, troque o bloco "stub" abaixo por
 * um insert em `meeting_requests` / `content_requests` (ver
 * supabase/migrations/0002_portal_v2.sql) e dispare a notificação real ao
 * CS / Social responsável.
 */

type RequestType = "meeting" | "content";

/** Stub de notificação interna — hoje só registra; depois vira e-mail/Slack/DB. */
function notifyTeam(type: RequestType, clientId: string | null, payload: unknown) {
  const target = type === "meeting" ? "CS responsável" : "Social Media responsável";
  // eslint-disable-next-line no-console
  console.info(
    `[notificação:stub] Nova solicitação de ${type} do cliente ${clientId ?? "?"} → notificar ${target}.`,
    payload,
  );
}

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

  // --- stub: aqui entraria o insert no Supabase ----------------------------
  // await supabase.from(type === "meeting" ? "meeting_requests" : "content_requests")
  //   .insert({ client_id: clientId, requested_by: user?.id, ...body.payload });
  notifyTeam(type, clientId, body.payload);

  // id sintético só para a UI confirmar o envio (sem persistência real ainda)
  const id = `req-${type}-${clientId ?? "anon"}-${Math.round(performance.now())}`;
  return NextResponse.json({ ok: true, id, persisted: false });
}
