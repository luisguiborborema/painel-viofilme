"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type LeadModalLayout = "modal" | "full" | "side";

const STORAGE_KEY = "crm-modal-layout";

const LayoutCtx = createContext<{
  layout: LeadModalLayout;
  setLayout: (l: LeadModalLayout) => void;
}>({ layout: "modal", setLayout: () => {} });

/** Layout atual do modal (Modal central / Tela cheia / Barra lateral). */
export const useLeadModalLayout = () => useContext(LayoutCtx);

/**
 * Moldura do modal do negócio (estilo ClickUp). Fecha com Esc ou clique no
 * fundo (router.back()). Suporta 3 apresentações — o seletor fica na barra
 * superior do conteúdo (LeadModalContent) e a preferência é lembrada.
 */
export function LeadModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // O modal só monta via navegação client-side (rota interceptada), então ler
  // a preferência salva já no inicializador é seguro (sem hidratação no server).
  const [layout, setLayoutState] = useState<LeadModalLayout>(() => {
    if (typeof window === "undefined") return "modal";
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "modal" || s === "full" || s === "side") return s;
    } catch {
      /* ignore */
    }
    return "modal";
  });

  const setLayout = (l: LeadModalLayout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [router]);

  const outer =
    layout === "modal"
      ? "items-center justify-center p-2 sm:p-4"
      : layout === "side"
        ? "justify-end"
        : "";

  const panel = {
    modal: "h-[94vh] max-h-[1040px] w-full max-w-[1560px] rounded-2xl border",
    full: "h-full w-full",
    side: "h-full w-full max-w-[760px] border-l",
  }[layout];

  return (
    <LayoutCtx.Provider value={{ layout, setLayout }}>
      {/* z-[60] fica acima do widget flutuante "Cadu" (z-50). */}
      <div className={cn("fixed inset-0 z-[60] flex", outer)}>
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => router.back()}
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative z-10 flex overflow-hidden border-line bg-surface shadow-2xl",
            panel,
          )}
        >
          {children}
        </div>
      </div>
    </LayoutCtx.Provider>
  );
}
