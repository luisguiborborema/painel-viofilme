import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint ausente" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
