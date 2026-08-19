import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listWhatsappGroups } from "@/lib/whatsapp/groups";
import { getWhatsappInstances, resolveInstance } from "@/lib/whatsapp/instances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (getWhatsappInstances().length === 0) return NextResponse.json({ groups: [], configured: false });

  const force = request.nextUrl.searchParams.get("force") === "1";
  const inst = resolveInstance(request.nextUrl.searchParams.get("instance"));
  const conn = inst ? { url: inst.url, token: inst.token } : undefined;
  const groups = await listWhatsappGroups(force, conn);
  return NextResponse.json({ groups, configured: true });
}
