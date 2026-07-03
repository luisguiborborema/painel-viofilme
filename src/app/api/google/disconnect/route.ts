import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { disconnectGoogle } from "@/lib/google/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desconecta a conta Google da agência (revoga + apaga tokens). */
export async function POST() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const ok = await disconnectGoogle();
  if (!ok) return NextResponse.json({ error: "não foi possível desconectar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
