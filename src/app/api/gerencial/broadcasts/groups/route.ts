import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { listWhatsappGroups } from "@/lib/whatsapp/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isWhatsappConfigured()) return NextResponse.json({ groups: [], configured: false });
  const force = request.nextUrl.searchParams.get("force") === "1";
  const groups = await listWhatsappGroups(force);
  return NextResponse.json({ groups, configured: true });
}
