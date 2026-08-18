"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/nav";
import type { Role } from "@/lib/auth/types";
import { CLIENT_TAB_ITEMS, clientTabHref } from "@/lib/client-tabs-nav";

const CLIENTES_HREF = "/gerencial/clientes";

export function Sidebar({
  groups,
  role,
  clientTabsOpOnly = false,
  collapsed = false,
  onToggle,
}: {
  groups: NavGroup[];
  role: Role;
  clientTabsOpOnly?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const home = role === "gerencial" ? "/gerencial" : "/cliente";

  // Dentro de um cliente (/gerencial/clientes/<id>/…), "Hub de Clientes" ganha
  // um submenu contextual com as abas daquele cliente (cada uma é uma rota).
  const clienteMatch = pathname.match(/^\/gerencial\/clientes\/([^/]+)/);
  const clienteId = clienteMatch?.[1];
  const clientTabs = clienteId
    ? CLIENT_TAB_ITEMS.filter((t) => t.key !== "metas" || !clientTabsOpOnly).map(
        (t) => ({ ...t, href: clientTabHref(clienteId, t.key) }),
      )
    : [];
  const tabActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Estado dos grupos-dropdown (lembrado por usuário). Default: aberto.
  const [openGroups, setOpenGroups] = usePersistentState<Record<string, boolean>>(
    `vio-nav-groups-${role}`,
    {},
  );
  const isActive = (href: string) =>
    href === pathname || (href !== home && pathname.startsWith(href));
  const toggleGroup = (title: string) =>
    setOpenGroups({ ...openGroups, [title]: openGroups[title] === false });

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        // sticky + altura de viewport: acompanha a rolagem em páginas longas
        // (sem self-start/altura fixa, o flex esticaria o aside e o sticky não pega).
        // z-40: sticky cria um stacking context próprio; sem z-index os flyouts do
        // menu recolhido ficariam ATRÁS do conteúdo da página.
        "hidden shrink-0 flex-col self-start sticky top-0 z-40 h-dvh bg-brand-700 text-white transition-[width] duration-200 print:!hidden lg:flex",
        collapsed ? "w-[52px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center px-3",
          collapsed ? "justify-center" : "justify-between pl-6 pr-3",
        )}
      >
        {!collapsed && (
          <Link href={home}>
            <LogoHorizontal className="h-6 text-white" />
          </Link>
        )}
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-2 pt-3">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-lime">
            {role === "gerencial" ? "Painel da agência" : "Área do cliente"}
          </span>
        </div>
      )}

      <nav className={cn("flex-1 space-y-2 py-3", collapsed ? "px-2" : "px-3")}>
        {groups.map((group, gi) => {
          const hasActive = group.items.some((it) => isActive(it.href));

          // Item no menu escuro expandido.
          const renderItem = (item: NavGroup["items"][number]) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            // Hub de Clientes dentro de um cliente: link + flyout (hover) com as
            // abas do cliente. O pl-2 faz a ponte de hover sem gap.
            if (item.href === CLIENTES_HREF && clientTabs.length > 0) {
              return (
                <div key={item.href} className="group/hub relative">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-white text-brand-700 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                    <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                  </Link>
                  <div className="absolute left-full top-0 z-50 hidden pl-2 group-hover/hub:block">
                    <div className="max-h-[calc(100dvh-1.5rem)] min-w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Abas do cliente
                      </p>
                      {clientTabs.map((t) => {
                        const TIcon = t.icon;
                        const tActive = tabActive(t.href);
                        return (
                          <Link
                            key={t.href}
                            href={t.href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                              tActive ? "bg-brand-500/10 text-brand-600" : "text-ink hover:bg-subtle",
                            )}
                          >
                            <TIcon className="h-4 w-4 shrink-0" />
                            {t.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-white text-brand-700 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          };

          // Item no flyout claro (modo recolhido).
          const renderFlyoutItem = (item: NavGroup["items"][number]) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            // Hub de Clientes dentro de um cliente: item + abas aninhadas.
            if (item.href === CLIENTES_HREF && clientTabs.length > 0) {
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-brand-500/10 text-brand-600" : "text-ink hover:bg-subtle",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> {item.label}
                  </Link>
                  <div className="ml-3 space-y-0.5 border-l border-line pl-2">
                    {clientTabs.map((t) => {
                      const TIcon = t.icon;
                      const tActive = tabActive(t.href);
                      return (
                        <Link
                          key={t.href}
                          href={t.href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                            tActive ? "bg-brand-500/10 text-brand-600" : "text-ink hover:bg-subtle",
                          )}
                        >
                          <TIcon className="h-3.5 w-3.5 shrink-0" /> {t.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand-500/10 text-brand-600" : "text-ink hover:bg-subtle",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" /> {item.label}
              </Link>
            );
          };

          // --- Modo recolhido: ícone do grupo + flyout lateral ---
          if (collapsed) {
            if (!group.title) {
              // Sem título (cliente): ícones diretos com tooltip.
              return (
                <div key={`group-${gi}`} className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={cn(
                          "group relative flex items-center justify-center rounded-xl p-2.5 transition-colors",
                          active ? "bg-white text-brand-700 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-medium text-surface shadow-lg group-hover:block">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            }
            const GIcon = group.icon ?? group.items[0].icon;
            return (
              <div key={group.title} className="group/gr relative">
                <button
                  className={cn(
                    "flex w-full items-center justify-center rounded-xl p-2.5 transition-colors",
                    hasActive ? "bg-white text-brand-700 shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <GIcon className="h-[18px] w-[18px]" />
                </button>
                {/* Flyout lateral — o pl-2 faz a ponte de hover sem gap. */}
                <div className="absolute left-full top-0 z-50 hidden pl-2 group-hover/gr:block">
                  <div className="max-h-[calc(100dvh-1.5rem)] min-w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.title}</p>
                    {group.items.map(renderFlyoutItem)}
                  </div>
                </div>
              </div>
            );
          }

          // --- Modo expandido: dropdown/accordion ---
          // Estado 100% do usuário (default aberto). Grupo com rota ativa também
          // pode ser recolhido — o ponto no cabeçalho sinaliza que há algo dentro.
          const expanded = !group.title || openGroups[group.title] !== false;
          return (
            <div key={group.title ?? `group-${gi}`} className="space-y-1">
              {group.title && (
                <button
                  onClick={() => group.title && toggleGroup(group.title)}
                  className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
                >
                  <span className="flex items-center gap-1.5">
                    {group.title}
                    {hasActive && !expanded && <span className="h-1.5 w-1.5 rounded-full bg-lime" />}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded ? "" : "-rotate-90")} />
                </button>
              )}
              {expanded && <div className="space-y-1">{group.items.map(renderItem)}</div>}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-6 py-4 text-xs text-white/50">Make it happen.</div>
      )}
    </aside>
  );
}
