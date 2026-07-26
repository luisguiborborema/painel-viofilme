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
      {children}
      <AiChat clientName={user.name} scope="gerencial" />
      <Toaster />
      <ActivityTracker />
    </AppShell>
  );
}
