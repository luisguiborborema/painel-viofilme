"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LogOut,
  PanelLeftClose,
  Palette,
  Plus,
  Search,
  Settings,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearSession } from "@/lib/auth/actions";
import { useTheme } from "@/components/theme/theme-provider";
import type { NavGroup } from "@/lib/nav";
import type { Role } from "@/lib/auth/types";

type Entity = { type: "Negócio" | "Empresa" | "Contato"; label: string; sublabel?: string; href: string };

type Cmd = {
  label: string;
  sublabel?: string;
  href?: string;
  run?: () => void;
  icon: LucideIcon;
  badge?: string;
};

const ENTITY_ICON: Record<Entity["type"], LucideIcon> = {
  Negócio: Target,
  Empresa: Building2,
  Contato: User,
};

/**
 * Paleta de comandos (⌘K): navega pelo menu e busca negócios/empresas/contatos.
 * Montada apenas quando aberta (o AppShell renderiza condicionalmente).
 */
export function CommandPalette({
  onClose,
  groups,
  role,
  onToggleSidebar,
}: {
  onClose: () => void;
  groups: NavGroup[];
  role: Role;
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const { cycle } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .catch(() => null);
      setEntities((res?.results as Entity[]) ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const ql = query.trim().toLowerCase();

  const actions: Cmd[] = [
    ...(role === "gerencial"
      ? [
          { label: "Novo negócio", href: "/gerencial/crm?tab=pipeline", icon: Plus, badge: "Ação" },
          { label: "Nova tarefa", href: "/gerencial/crm?tab=tarefas", icon: Plus, badge: "Ação" },
          { label: "Nova empresa", href: "/gerencial/crm?tab=empresas", icon: Plus, badge: "Ação" },
          { label: "Novo contato", href: "/gerencial/crm?tab=contatos", icon: Plus, badge: "Ação" },
        ]
      : []),
    { label: "Configurações", href: "/configuracoes", icon: Settings, badge: "Ação" },
    { label: "Alternar tema (claro/escuro)", run: cycle, icon: Palette, badge: "Ação" },
    { label: "Recolher/expandir menu", run: onToggleSidebar, icon: PanelLeftClose, badge: "Ação" },
    {
      label: "Sair",
      run: async () => {
        await clearSession();
        window.location.assign("/login");
      },
      icon: LogOut,
      badge: "Ação",
    },
  ].filter((a) => !ql || a.label.toLowerCase().includes(ql));

  const navItems: Cmd[] = groups
    .flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href, icon: i.icon, badge: g.title })))
    .filter((i) => !ql || i.label.toLowerCase().includes(ql));

  const entityItems: Cmd[] = (ql.length >= 2 ? entities : []).map((e) => ({
    label: e.label,
    sublabel: e.sublabel,
    href: e.href,
    icon: ENTITY_ICON[e.type],
    badge: e.type,
  }));

  const all: Cmd[] = [...actions, ...navItems, ...entityItems];
  const selIndex = all.length ? Math.min(sel, all.length - 1) : 0;

  function go(cmd?: Cmd) {
    if (!cmd) return;
    onClose();
    if (cmd.run) cmd.run();
    else if (cmd.href) router.push(cmd.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel(Math.min(selIndex + 1, all.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel(Math.max(selIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(all[selIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, negócios, empresas, contatos…"
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-muted"
          />
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {all.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              {ql.length >= 2 ? "Nada encontrado." : "Digite para buscar."}
            </p>
          ) : (
            all.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={`${cmd.href}-${i}`}
                  onClick={() => go(cmd)}
                  onMouseMove={() => setSel(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    i === selIndex ? "bg-brand-600 text-white" : "text-ink hover:bg-subtle",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", i === selIndex ? "text-white" : "text-muted")} />
                  <span className="min-w-0 flex-1 truncate">
                    {cmd.label}
                    {cmd.sublabel && (
                      <span className={cn("ml-2 text-xs", i === selIndex ? "text-white/70" : "text-muted")}>
                        {cmd.sublabel}
                      </span>
                    )}
                  </span>
                  {cmd.badge && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        i === selIndex ? "bg-white/20 text-white" : "bg-subtle text-muted",
                      )}
                    >
                      {cmd.badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
