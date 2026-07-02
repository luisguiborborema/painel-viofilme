import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { notifyManagement } from "@/lib/push/send";

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

  // Gatilho: notifica a equipe gerencial (push).
  await notifyManagement(
    type === "meeting"
      ? {
          title: "Nova solicitação de reunião",
          body: `${clientName} pediu um horário.`,
          url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
        }
      : {
          title: "Nova solicitação de conteúdo",
          body: `${clientName} enviou um pedido de conteúdo.`,
          url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
        },
  );

  const id = `req-${type}-${clientId ?? "anon"}-${Math.round(performance.now())}`;
  return NextResponse.json({ ok: true, id, persisted: false });
}
