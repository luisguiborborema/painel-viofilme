"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
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
  const [searchOpen, setSearchOpen] = useState(false);

  // Atalhos globais: ⌘/Ctrl+K abre a busca, ⌘/Ctrl+B recolhe/expande o menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (k === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        groups={groups}
        role={user.role}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} groups={groups} onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      {searchOpen && (
        <CommandPalette
          onClose={() => setSearchOpen(false)}
          groups={groups}
          role={user.role}
          onToggleSidebar={() => setCollapsed((c) => !c)}
        />
      )}
    </div>
  );
}
