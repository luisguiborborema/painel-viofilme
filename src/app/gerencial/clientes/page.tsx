import { Users } from "lucide-react";
import { getHubClientsOps } from "@/lib/data/queries";
import { getSession } from "@/lib/auth/session";
import { tierHasFullAccess } from "@/lib/access";
import { HubClientes } from "@/components/gerencial/hub-clientes";

export const metadata = { title: "Hub de clientes" };


export default async function GerencialClientes() {
  const [clients, user] = await Promise.all([getHubClientsOps(), getSession()]);
  const canDelete = tierHasFullAccess(user?.tier);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Hub de clientes
          </h1>
          <p className="text-sm text-muted">
            A mesa de cada cliente — o que precisa resolver hoje, por squad.
          </p>
        </div>
      </div>

      <HubClientes clients={clients} meName={user?.name} canDelete={canDelete} />
    </div>
  );
}
