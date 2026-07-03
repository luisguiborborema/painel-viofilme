import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type TeamMemberRow = {
  id: string;
  email: string;
  name: string;
  teamRole: string | null;
  allowedSections: string[] | null;
  whatsapp: string | null;
  active: boolean;
};

/** Lista os usuários gerenciais (perfil + e-mail/status via Auth). Só com service-role. */
export async function listTeam(): Promise<TeamMemberRow[]> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return [];
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, team_role, allowed_sections, whatsapp")
    .eq("role", "gerencial");

  const { data: usersData } = await admin.auth.admin.listUsers();
  const now = Date.now();
  const authById = new Map(
    (usersData?.users ?? []).map((u) => {
      const banned = (u as { banned_until?: string | null }).banned_until;
      const active = !banned || new Date(banned).getTime() <= now;
      return [u.id, { email: u.email ?? "", active }];
    }),
  );

  return (profiles ?? []).map((p) => {
    const auth = authById.get(p.id as string);
    return {
      id: p.id as string,
      email: auth?.email ?? "",
      name: (p.full_name as string | null) ?? "",
      teamRole: (p.team_role as string | null) ?? null,
      allowedSections: (p.allowed_sections as string[] | null) ?? null,
      whatsapp: (p.whatsapp as string | null) ?? null,
      active: auth?.active ?? true,
    };
  });
}
