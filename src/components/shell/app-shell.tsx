"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ReadOnlyProvider } from "./read-only-context";
import { TourProvider } from "./tour-provider";
import { visibleNav } from "@/lib/nav";
import { hasFullAccess, canAccessSection } from "@/lib/access";
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
  // Perfil operacional (sem Financeiro/Comercial) não vê a aba Metas do cliente
  // no submenu lateral — mesma regra do gating da página /metas.
  const clientTabsOpOnly =
    !hasFullAccess(user.allowedSections) &&
    !canAccessSection(user.allowedSections, "financeiro") &&
    !canAccessSection(user.allowedSections, "crm");
  // Padrão HubSpot: menu lateral minimizado (quem já tiver preferência salva mantém).
  const [collapsed, setCollapsed] = usePersistentState("vio-sidebar-collapsed", true);
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
    <TourProvider>
    <div className="flex min-h-screen bg-canvas pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <Sidebar
        groups={groups}
        role={user.role}
        clientTabsOpOnly={clientTabsOpOnly}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} groups={groups} onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:p-0 md:p-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-8 lg:pb-[max(2rem,env(safe-area-inset-bottom))]">
          <ReadOnlyProvider value={Boolean(user.readOnly)}>{children}</ReadOnlyProvider>
        </main>
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
    </TourProvider>
  );
}
