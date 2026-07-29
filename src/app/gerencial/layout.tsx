import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessPath, firstAllowedHref } from "@/lib/access";
import { AppShell } from "@/components/shell/app-shell";
import { AiChat } from "@/components/cliente/ai-chat";
import { Toaster } from "@/components/ui/toast";
import { ActivityTracker } from "@/components/shell/activity-tracker";

export default async function GerencialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "gerencial") redirect("/cliente");

  // Bloqueio por seção (RBAC): redireciona para a 1ª aba permitida.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!canAccessPath(user.allowedSections, pathname)) {
    redirect(firstAllowedHref(user.allowedSections));
  }

  return (
    <AppShell user={user}>
      {user.readOnly && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Modo somente leitura — você pode visualizar tudo, mas ações de criar, editar e excluir ficam desativadas.
        </div>
      )}
      {children}
      <AiChat clientName={user.name} scope="gerencial" />
      <Toaster />
      <ActivityTracker />
    </AppShell>
  );
}
