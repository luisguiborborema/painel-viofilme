import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConversations } from "@/lib/data/queries";
import type { WaStatus } from "@/lib/data/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista de conversas do inbox (com filtros opcionais). Usado no polling. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const assignedTo = sp.get("assignedTo") || undefined;
  const status = (sp.get("status") as WaStatus) || undefined;
  const conversations = await getConversations({ assignedTo, status });
  return NextResponse.json({ conversations });
}
