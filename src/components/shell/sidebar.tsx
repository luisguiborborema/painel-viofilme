"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/nav";
import type { Role } from "@/lib/auth/types";

export function Sidebar({
  groups,
  role,
  collapsed = false,
  onToggle,
}: {
  groups: NavGroup[];
  role: Role;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const home = role === "gerencial" ? "/gerencial" : "/cliente";

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
      className={cn(
        "hidden shrink-0 flex-col bg-brand-700 text-white transition-[width] duration-200 lg:flex",
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
          // Grupo com título vira dropdown; abre se estado != false ou contém a rota ativa.
          const expanded =
            !group.title || collapsed || openGroups[group.title] !== false || hasActive;

          const renderItem = (item: NavGroup["items"][number]) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl text-sm font-medium transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && item.label}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-medium text-surface shadow-lg group-hover:block">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          };

          return (
            <div key={group.title ?? `group-${gi}`} className="space-y-1">
              {group.title &&
                (collapsed ? (
                  gi > 0 && <div className="mx-2 mb-1 h-px bg-white/10" />
                ) : (
                  <button
                    onClick={() => toggleGroup(group.title!)}
                    className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
                  >
                    <span className="flex items-center gap-1.5">
                      {group.title}
                      {hasActive && !expanded && <span className="h-1.5 w-1.5 rounded-full bg-lime" />}
                    </span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", expanded ? "" : "-rotate-90")}
                    />
                  </button>
                ))}
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
