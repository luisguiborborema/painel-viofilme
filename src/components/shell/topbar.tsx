"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL, type SessionUser } from "@/lib/auth/types";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Topbar({
  user,
  items,
}: {
  user: SessionUser;
  items: NavItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur md:px-6">
      <button
        className="rounded-lg p-2 text-ink hover:bg-canvas lg:hidden"
        onClick={() => setMobileNav((v) => !v)}
        aria-label="Menu"
      >
        {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {user.role === "cliente" && user.clientName
            ? user.clientName
            : "Painel Viofilme"}
        </p>
        <p className="truncate text-xs text-muted">
          {ROLE_LABEL[user.role]} · {user.email}
        </p>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2 hover:bg-canvas"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(user.name)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">
                  {user.name}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <div className="my-1 h-px bg-line" />
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Navegação mobile */}
      {mobileNav && (
        <div className="absolute inset-x-0 top-16 z-20 border-b border-line bg-surface p-3 shadow-lg lg:hidden">
          <nav className="space-y-1">
            {items.map((item) => {
              const active =
                item.href === pathname ||
                (item.href.split("/").length > 2 &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNav(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink hover:bg-canvas",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
