import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico TEMPORÁRIO — roda TODAS as leituras dentro do server component
 * (mesmo contexto dos layouts), para ver onde o perfil vira 'cliente'. Remover.
 */
export default async function DebugSession() {
  const out: Record<string, unknown> = { hasServiceRole: hasServiceRole() };

  try {
    const supabase = await createClient();
    const { data: u, error: uErr } = await supabase.auth.getUser();
    const uid = u?.user?.id ?? null;
    out.getUser = { id: uid, email: u?.user?.email ?? null, error: uErr?.message ?? null };

    if (uid) {
      const rls = await supabase.from("profiles").select("role, client_id").eq("id", uid).maybeSingle();
      out.rlsRead = { role: rls.data?.role ?? null, error: rls.error?.message ?? null };

      if (hasServiceRole()) {
        const admin = createAdminClient();
        const adm = await admin.from("profiles").select("role, client_id").eq("id", uid).maybeSingle();
        out.serviceRead = { role: adm.data?.role ?? null, error: adm.error?.message ?? null };
      }
    }
  } catch (e) {
    out.threw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  const session = await getSession().catch((e) => ({ __error: String(e) }));
  out.getSessionResult = session && "role" in session ? { role: (session as { role: string }).role } : session;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontWeight: 700, marginBottom: 12 }}>Diagnóstico de sessão (server component)</h1>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f5", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(out, null, 2)}
      </pre>
    </div>
  );
}
