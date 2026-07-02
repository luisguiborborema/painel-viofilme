import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { trigger } from "@/lib/push/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disparo de notificações por evento da UI. Validado por papel:
 * - cliente: content_decision (aprovou / pediu ajuste)
 * - gerencial: report_ready, content_ready
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let body: {
    event?: string;
    decision?: "approved" | "changes";
    title?: string;
    clientId?: string;
    period?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    switch (body.event) {
      case "content_decision": {
        if (user.role !== "cliente" || !user.clientId) {
          return NextResponse.json({ error: "não permitido" }, { status: 403 });
        }
        await trigger.contentDecision(
          user.clientId,
          user.clientName ?? user.name,
          body.decision === "approved" ? "approved" : "changes",
          body.title ?? "conteúdo",
        );
        break;
      }
      case "report_ready": {
        if (user.role !== "gerencial" || !body.clientId) {
          return NextResponse.json({ error: "não permitido" }, { status: 403 });
        }
        await trigger.reportReady(body.clientId, body.period ?? "este mês");
        break;
      }
      case "content_ready": {
        if (user.role !== "gerencial" || !body.clientId) {
          return NextResponse.json({ error: "não permitido" }, { status: 403 });
        }
        await trigger.contentAwaitingApproval(body.clientId, body.title);
        break;
      }
      default:
        return NextResponse.json({ error: "evento inválido" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "falha ao notificar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
