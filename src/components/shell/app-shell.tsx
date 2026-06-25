"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";

export function AppShell({
  user,
  children,
  theme = "light",
}: {
  user: SessionUser;
  children: React.ReactNode;
  theme?: "light" | "dark";
}) {
  const items = navForRole(user.role);
  const dark = theme === "dark";
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} role={user.role} />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          dark && "theme-dark bg-canvas",
        )}
      >
        <Topbar user={user} items={items} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
