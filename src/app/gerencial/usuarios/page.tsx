import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { firstAllowedHref, isAdminTier } from "@/lib/access";
import { listSquads, listTeam } from "@/lib/auth/team";
import { UsersAdmin } from "@/components/gerencial/users-admin";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Só admin gerencia usuários.
  if (!isAdminTier(user.tier)) redirect(firstAllowedHref(user.allowedSections));

  const [team, squads] = await Promise.all([listTeam(), listSquads()]);

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Crie usuários, defina perfil de acesso, WhatsApp e time." />
      <UsersAdmin team={team} squads={squads} selfId={user.id} />
    </div>
  );
}
