import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type TeamMemberRow = {
  id: string;
  email: string;
  name: string;
  teamRole: string | null;
  allowedSections: string[] | null;
};

/** Lista os usuários gerenciais (perfil + e-mail via Auth). Só com service-role. */
export async function listTeam(): Promise<TeamMemberRow[]> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return [];
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, team_role, allowed_sections")
    .eq("role", "gerencial");

  const { data: usersData } = await admin.auth.admin.listUsers();
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: emailById.get(p.id as string) ?? "",
    name: (p.full_name as string | null) ?? "",
    teamRole: (p.team_role as string | null) ?? null,
    allowedSections: (p.allowed_sections as string[] | null) ?? null,
  }));
}
