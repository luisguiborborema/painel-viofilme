import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listWhatsappInstancesPublic } from "@/lib/whatsapp/instances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const instances = await listWhatsappInstancesPublic();
  return NextResponse.json({ instances });
}
