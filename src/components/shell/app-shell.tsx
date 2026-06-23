"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { navForRole } from "@/lib/nav";
import type { SessionUser } from "@/lib/auth/types";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const items = navForRole(user.role);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} items={items} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
