import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function GerencialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "gerencial") redirect("/cliente");
  return <AppShell user={user}>{children}</AppShell>;
}
