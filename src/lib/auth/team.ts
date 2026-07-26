import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type TeamMemberRow = {
  id: string;
  email: string;
  name: string;
  teamRole: string | null;
  tier: string | null;
  allowedSections: string[] | null;
  whatsapp: string | null;
  squadId: string | null;
  squadName: string | null;
  active: boolean;
};

export type SquadRow = { id: string; name: string; defaultSections: string[] | null };

/** Times (squads) para o seletor de usuários. Só com service-role. */
export async function listSquads(): Promise<SquadRow[]> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("squads")
    .select("id, name, default_sections")
    .order("name", { ascending: true });
  return (data ?? []).map((s) => ({
    id: String(s.id),
    name: String(s.name ?? "Time"),
    defaultSections: (s.default_sections as string[] | null) ?? null,
  }));
}

/** Lista os usuários gerenciais (perfil + e-mail/status via Auth). Só com service-role. */
export async function listTeam(): Promise<TeamMemberRow[]> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return [];
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, team_role, profile_tier, allowed_sections, whatsapp, squad_id")
    .eq("role", "gerencial");

  const squads = await listSquads();
  const squadName = new Map(squads.map((s) => [s.id, s.name]));

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
    const squadId = (p.squad_id as string | null) ?? null;
    return {
      id: p.id as string,
      email: auth?.email ?? "",
      name: (p.full_name as string | null) ?? "",
      teamRole: (p.team_role as string | null) ?? null,
      tier: (p.profile_tier as string | null) ?? null,
      allowedSections: (p.allowed_sections as string[] | null) ?? null,
      whatsapp: (p.whatsapp as string | null) ?? null,
      squadId,
      squadName: squadId ? squadName.get(squadId) ?? null : null,
      active: auth?.active ?? true,
    };
  });
}
