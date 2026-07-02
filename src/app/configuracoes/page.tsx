import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/types";
import { isPushConfigured, VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { PushToggle } from "@/components/settings/push-toggle";

export default async function Configuracoes() {
  const user = await getSession();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-brand-300">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Configurações
          </h1>
          <p className="text-sm text-muted">
            Preferências da sua conta e notificações.
          </p>
        </div>
      </div>

      {/* Notificações */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Notificações</h2>
        <PushToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
        {!isPushConfigured() && (
          <p className="mt-2 text-xs text-muted">
            As notificações push ainda não foram habilitadas pela equipe
            (configuração pendente no servidor).
          </p>
        )}
      </Card>

      {/* Aparência */}
      <Card className="flex items-center justify-between p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Aparência</h2>
          <p className="text-xs text-muted">
            Tema claro, escuro ou automático (segue o sistema).
          </p>
        </div>
        <ThemeToggle />
      </Card>

      {/* Conta */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Conta</h2>
        <dl className="divide-y divide-line text-sm">
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">Nome</dt>
            <dd className="font-medium text-ink">{user?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium text-ink">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">Acesso</dt>
            <dd className="font-medium text-ink">
              {user ? ROLE_LABEL[user.role] : "—"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
