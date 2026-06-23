import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/routes";

export default async function RootPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  redirect(homeForRole(user.role));
}
