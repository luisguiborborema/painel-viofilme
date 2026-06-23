"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoHorizontal } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";
import type { Role } from "@/lib/auth/types";

export function Sidebar({
  items,
  role,
}: {
  items: NavItem[];
  role: Role;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-brand-700 text-white lg:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <Link href={role === "gerencial" ? "/gerencial" : "/cliente"}>
          <LogoHorizontal className="h-6 text-white" />
        </Link>
      </div>

      <div className="px-4 pb-2 pt-3">
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-lime">
          {role === "gerencial" ? "Painel da agência" : "Área do cliente"}
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {items.map((item) => {
          const active =
            item.href === pathname ||
            (item.href !== `/${role}` && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 text-xs text-white/50">
        Make it happen.
      </div>
    </aside>
  );
}
