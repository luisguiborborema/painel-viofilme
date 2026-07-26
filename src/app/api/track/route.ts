import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/audit/log";
import { areaForPath } from "@/lib/audit/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registro de navegação (page-view) — chamado pelo ActivityTracker do cliente. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return new NextResponse(null, { status: 204 });

  let path = "";
  try {
    path = String(((await req.json()) as { path?: string }).path ?? "");
  } catch {
    /* corpo vazio/inválido */
  }
  if (!path) return new NextResponse(null, { status: 204 });

  await logEvent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    panel: user.role === "cliente" ? "cliente" : "gerencial",
    action: "pageview",
    area: areaForPath(path),
    target: path,
  });
  return new NextResponse(null, { status: 204 });
}
