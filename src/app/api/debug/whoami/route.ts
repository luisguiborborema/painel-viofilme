import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico TEMPORÁRIO de sessão. Mostra exatamente o que o servidor lê para
 * decidir o papel do usuário — sem expor segredos. Remover depois de resolver.
 * Acesse logado em /api/debug/whoami
 */
export async function GET() {
  const out: Record<string, unknown> = {
    supabaseConfigured: isSupabaseConfigured(),
    hasServiceRole: hasServiceRole(),
  };

  if (!isSupabaseConfigured()) {
    out.mode = "DEMO — as env NEXT_PUBLIC_SUPABASE_URL/ANON_KEY não estão setadas na Vercel.";
    return NextResponse.json(out);
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  out.getUser = { ok: !!user, id: user?.id ?? null, email: user?.email ?? null, error: userErr?.message ?? null };

  if (!user) return NextResponse.json(out);

  // Leitura via RLS (cliente autenticado)
  const rls = await supabase
    .from("profiles")
    .select("id, role, client_id, allowed_sections")
    .eq("id", user.id)
    .maybeSingle();
  out.profileViaRLS = { found: !!rls.data, role: rls.data?.role ?? null, clientId: rls.data?.client_id ?? null, error: rls.error?.message ?? null };

  // Leitura via service role (bypassa RLS), se disponível
  if (hasServiceRole()) {
    try {
      const admin = createAdminClient();
      const adm = await admin
        .from("profiles")
        .select("id, role, client_id, allowed_sections")
        .eq("id", user.id)
        .maybeSingle();
      out.profileViaServiceRole = { found: !!adm.data, role: adm.data?.role ?? null, clientId: adm.data?.client_id ?? null, error: adm.error?.message ?? null };
    } catch (e) {
      out.profileViaServiceRole = { error: e instanceof Error ? e.message : "falha" };
    }
  } else {
    out.profileViaServiceRole = "SUPABASE_SERVICE_ROLE_KEY ausente na Vercel";
  }

  return NextResponse.json(out);
}
