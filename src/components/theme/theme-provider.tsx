"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  /** Preferência escolhida (inclui "system"). */
  preference: ThemePreference;
  /** Tema realmente aplicado ("light" | "dark"). */
  theme: ResolvedTheme;
  /** Alterna Automático → Claro → Escuro → Automático. */
  cycle: () => void;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  theme: "dark",
  cycle: () => {},
  setPreference: () => {},
});

const STORAGE_KEY = "vio-theme";

function systemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemDark() ? "dark" : "light";
  return pref;
}

function applyResolved(r: ResolvedTheme) {
  document.documentElement.classList.toggle("theme-dark", r === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("dark");

  // Inicializa a partir do armazenamento (padrão: Automático).
  useEffect(() => {
    let pref: ThemePreference = "system";
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "light" || s === "dark" || s === "system") pref = s;
    } catch {
      /* ignore */
    }
    setPreferenceState(pref);
    const r = resolve(pref);
    setTheme(r);
    applyResolved(r);
  }, []);

  // No modo Automático, acompanha mudanças do sistema operacional.
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light";
      setTheme(r);
      applyResolved(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const commit = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    const r = resolve(p);
    setTheme(r);
    applyResolved(r);
  }, []);

  const cycle = useCallback(() => {
    const order: ThemePreference[] = ["system", "light", "dark"];
    setPreferenceState((prev) => {
      const next = order[(order.indexOf(prev) + 1) % order.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      const r = resolve(next);
      setTheme(r);
      applyResolved(r);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ preference, theme, cycle, setPreference: commit }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Monitor }[] =
  [
    { value: "system", label: "Automático", Icon: Monitor },
    { value: "light", label: "Claro", Icon: Sun },
    { value: "dark", label: "Escuro", Icon: Moon },
  ];

/** Menu de tema: Automático / Claro / Escuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];
  const TriggerIcon = current.Icon;

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Tema: ${current.label}`}
        aria-label={`Tema: ${current.label}. Abrir menu de tema.`}
      >
        <TriggerIcon className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-line bg-surface p-1.5 shadow-lg"
          >
            <p className="px-2.5 py-1 text-xs font-medium text-muted">Tema</p>
            {OPTIONS.map((opt) => {
              const active = opt.value === preference;
              return (
                <button
                  key={opt.value}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setPreference(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-500/15 text-brand-300"
                      : "text-ink hover:bg-subtle",
                  )}
                >
                  <opt.Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {active && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
