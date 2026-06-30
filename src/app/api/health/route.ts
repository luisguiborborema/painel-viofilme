import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasServiceRole } from "@/lib/supabase/admin";
import { isMetaConfigured } from "@/lib/meta/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico de configuração — só booleans, nenhum segredo exposto.
 * GET /api/health → mostra o que ESTE deploy está enxergando das env vars.
 */
export async function GET() {
  return NextResponse.json({
    mode: isSupabaseConfigured() ? "supabase" : "demo",
    env: {
      supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseUrlLooksValid: isSupabaseConfigured(),
      anonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleSet: hasServiceRole(),
      metaConfigured: isMetaConfigured(),
      anthropicSet: Boolean(process.env.ANTHROPIC_API_KEY),
      cronSecretSet: Boolean(process.env.CRON_SECRET),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
  });
}
