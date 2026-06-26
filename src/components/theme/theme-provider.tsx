"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
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

const LABELS: Record<ThemePreference, string> = {
  system: "Automático",
  light: "Claro",
  dark: "Escuro",
};

const ICONS = { system: Monitor, light: Sun, dark: Moon };

/** Botão de tema: alterna Automático → Claro → Escuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, cycle } = useTheme();
  const Icon = ICONS[preference];
  return (
    <button
      onClick={cycle}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-ink",
        className,
      )}
      title={`Tema: ${LABELS[preference]} (clique para alternar)`}
      aria-label={`Tema: ${LABELS[preference]}. Clique para alternar.`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
