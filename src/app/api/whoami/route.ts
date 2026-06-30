import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico do usuário logado — mostra o que o app enxerga do PRÓPRIO perfil
 * em runtime (sob RLS). Não expõe dados de terceiros.
 * GET /api/whoami
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ mode: "demo" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "sem sessão (não logado)" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, client_id, clients(name)")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    authUserId: user.id,
    email: user.email,
    profileFound: Boolean(profile),
    profileError: error?.message ?? null,
    role: profile?.role ?? null,
    clientId: profile?.client_id ?? null,
    clientName:
      (Array.isArray(profile?.clients)
        ? profile?.clients[0]?.name
        : (profile?.clients as { name: string } | null)?.name) ?? null,
  });
}
