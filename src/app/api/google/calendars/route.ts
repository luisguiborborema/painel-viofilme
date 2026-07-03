import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCalendars } from "@/lib/google/calendar";
import { getValidAccess } from "@/lib/google/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista os calendários da conta + a seleção atual (write/read). */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const [calendars, access] = await Promise.all([listCalendars(), getValidAccess()]);
  return NextResponse.json({
    calendars,
    writeCalendarId: access?.calendarId ?? "primary",
    readCalendarIds: access?.readCalendarIds ?? [],
  });
}
