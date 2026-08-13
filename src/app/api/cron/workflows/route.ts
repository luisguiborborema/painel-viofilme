import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { processDueWorkflows } from "@/lib/crm/workflow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron dos Workflows (Vercel Cron → CRON_SECRET). Processa as inscrições vencidas. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, skipped: "sem service-role" });
  }
  try {
    const admin = createAdminClient();
    const result = await processDueWorkflows(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "erro" }, { status: 500 });
  }
}
