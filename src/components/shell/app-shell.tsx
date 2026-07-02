"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { visibleNav } from "@/lib/nav";
import { usePersistentState } from "@/lib/use-persistent-state";
import type { SessionUser } from "@/lib/auth/types";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const groups = visibleNav(user);
  const [collapsed, setCollapsed] = usePersistentState("vio-sidebar-collapsed", false);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        groups={groups}
        role={user.role}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} groups={groups} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
