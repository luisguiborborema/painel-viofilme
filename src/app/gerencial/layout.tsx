import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  canAccessSection,
  firstAllowedHref,
  pathToSection,
} from "@/lib/access";
import { AppShell } from "@/components/shell/app-shell";
import { AiChat } from "@/components/cliente/ai-chat";

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
  const section = pathToSection(pathname);
  if (section && !canAccessSection(user.allowedSections, section)) {
    redirect(firstAllowedHref(user.allowedSections));
  }

  return (
    <AppShell user={user}>
      {children}
      <AiChat clientName={user.name} scope="gerencial" />
    </AppShell>
  );
}
