import { Users } from "lucide-react";
import { getHubClients } from "@/lib/data/operacao";
import { HubClientes } from "@/components/gerencial/hub-clientes";

export default function GerencialClientes() {
  const clients = getHubClients();

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
            Visão individualizada da carteira — estratégia, saúde e onboarding.
          </p>
        </div>
      </div>

      <HubClientes clients={clients} />
    </div>
  );
}
