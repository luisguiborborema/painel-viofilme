import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getClientDeliverables } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = new Set(["Reels", "Feed", "Stories", "Carrossel"]);

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  const deliverables = await getClientDeliverables(clientId);
  return NextResponse.json({ deliverables });
}

/** Define a quantidade mensal de um formato (upsert). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { clientId?: string; format?: string; monthlyQty?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId || !b.format || !FORMATS.has(b.format)) {
    return NextResponse.json({ error: "clientId/formato inválido" }, { status: 400 });
  }
  const qty = Math.max(0, Math.round(Number(b.monthlyQty) || 0));

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_deliverables")
    .upsert(
      { client_id: b.clientId, format: b.format, monthly_qty: qty, updated_at: new Date().toISOString() },
      { onConflict: "client_id,format" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
