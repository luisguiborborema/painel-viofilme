import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDeliveryStats } from "@/lib/data/broadcast-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([7, 14, 30, 0]);

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const raw = Number(request.nextUrl.searchParams.get("days") ?? 14);
  const days = ALLOWED.has(raw) ? raw : 14;
  const stats = await getDeliveryStats(days);
  return NextResponse.json(stats);
}
