import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status REAL da conexão Meta de um cliente (para a Central de relatórios). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("client") ?? "";
  const canSync = isSupabaseConfigured() && hasServiceRole();
  if (!clientId || !isSupabaseConfigured()) {
    return NextResponse.json({ connected: false, hasToken: false, hasAdAccount: false, lastSyncedAt: null, pageName: null, canSync });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("meta_connections")
    .select("access_token, ad_account_id, last_synced_at, ig_user_id, page_name")
    .eq("client_id", clientId)
    .maybeSingle();
  const row = data as {
    access_token?: string | null;
    ad_account_id?: string | null;
    last_synced_at?: string | null;
    ig_user_id?: string | null;
    page_name?: string | null;
  } | null;

  return NextResponse.json({
    connected: !!row,
    hasToken: !!row?.access_token,
    hasAdAccount: !!row?.ad_account_id,
    lastSyncedAt: row?.last_synced_at ?? null,
    pageName: row?.page_name ?? null,
    canSync,
  });
}
