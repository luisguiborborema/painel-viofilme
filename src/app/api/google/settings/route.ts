import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { saveCalendarSettings } from "@/lib/google/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salva os calendários escolhidos (criar em / mostrar na agenda). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { writeCalendarId?: string; readCalendarIds?: string[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const ok = await saveCalendarSettings({
    writeCalendarId: b.writeCalendarId,
    readCalendarIds: Array.isArray(b.readCalendarIds) ? b.readCalendarIds : undefined,
  });
  if (!ok) return NextResponse.json({ error: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
