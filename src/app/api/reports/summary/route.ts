import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getReportSummaryView } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resumo real do relatório de um cliente (gerencial). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  if (!clientId) {
    return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  }
  const summary = await getReportSummaryView(clientId);
  return NextResponse.json({ summary });
}
