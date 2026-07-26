import Link from "next/link";
import { Bell, Palette, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/types";
import { isAdminTier } from "@/lib/access";
import { isPushConfigured, VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sanitizeMuted } from "@/lib/notify-categories";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { PushToggle } from "@/components/settings/push-toggle";
import { WhatsappTest } from "@/components/settings/whatsapp-test";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { AvatarUpload } from "@/components/settings/avatar-upload";

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
  const isAdmin = user?.role === "gerencial" && isAdminTier(user.tier);

  // Preferências de notificação (categorias silenciadas) do usuário atual.
  let mutedCategories: string[] = [];
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notification_preferences")
      .select("muted")
      .eq("user_id", user.id)
      .maybeSingle();
    mutedCategories = sanitizeMuted(data?.muted);
  }

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
        {user?.role === "gerencial" && (
          <WhatsappTest configured={isWhatsappConfigured()} />
        )}
        {user && (
          <NotificationPreferences role={user.role} initialMuted={mutedCategories} />
        )}
      </Card>

      {/* Usuários & acessos — agora numa página dedicada (só admin). */}
      {isAdmin && (
        <Card className="p-5">
          <SectionHeader
            icon={ShieldCheck}
            title="Usuários & acessos"
            subtitle="Crie usuários, defina perfil (admin/gestor/colaborador/viewer), WhatsApp e time."
          />
          <Link
            href="/gerencial/usuarios"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <ShieldCheck className="h-4 w-4" /> Gerenciar usuários
          </Link>
        </Card>
      )}

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
        <SectionHeader icon={UserRound} title="Conta" subtitle="Sua foto e dados de acesso." />
        <div className="mb-4 border-b border-line pb-4">
          <AvatarUpload name={user?.name ?? "Usuário"} initialUrl={user?.avatarUrl} />
        </div>
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
