import { Bell, Palette, Settings, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/types";
import { isPushConfigured, VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { PushToggle } from "@/components/settings/push-toggle";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Bell;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export default async function Configuracoes() {
  const user = await getSession();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
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
        <SectionHeader
          icon={Bell}
          title="Notificações"
          subtitle="Escolha se quer receber avisos neste dispositivo."
        />
        <PushToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
        {!isPushConfigured() && (
          <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
            As notificações push ainda não foram habilitadas pela equipe
            (configuração pendente no servidor).
          </p>
        )}
      </Card>

      {/* Aparência */}
      <Card className="p-5">
        <SectionHeader icon={Palette} title="Aparência" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Tema claro, escuro ou automático (segue o sistema).
          </p>
          <ThemeToggle />
        </div>
      </Card>

      {/* Conta */}
      <Card className="p-5">
        <SectionHeader icon={UserRound} title="Conta" />
        <dl className="divide-y divide-line text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Nome</dt>
            <dd className="font-medium text-ink">{user?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium text-ink">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Acesso</dt>
            <dd>
              <span className="rounded-full bg-subtle-strong px-2.5 py-0.5 text-xs font-medium text-ink">
                {user ? ROLE_LABEL[user.role] : "—"}
              </span>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
