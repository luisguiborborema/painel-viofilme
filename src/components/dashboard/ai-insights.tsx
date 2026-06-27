"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Lightbulb,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Insight = { type: string; title: string; text: string; action?: string };

const STYLE: Record<string, { icon: LucideIcon; chip: string; tag: string }> = {
  positivo: { icon: TrendingUp, chip: "bg-emerald-500/15 text-emerald-300", tag: "Positivo" },
  destaque: { icon: Star, chip: "bg-emerald-500/15 text-emerald-300", tag: "Destaque" },
  atencao: { icon: AlertTriangle, chip: "bg-amber-500/15 text-amber-300", tag: "Atenção" },
  oportunidade: { icon: Lightbulb, chip: "bg-sky-500/15 text-sky-300", tag: "Oportunidade" },
  otimizacao: { icon: Sparkles, chip: "bg-violet-500/15 text-violet-300", tag: "Otimização" },
  orcamento: { icon: Wallet, chip: "bg-amber-500/15 text-amber-300", tag: "Orçamento" },
  padrao: { icon: Sparkles, chip: "bg-brand-500/15 text-brand-300", tag: "Padrão" },
};

export function AiInsights({
  mode,
  businessType,
  data,
  fallback,
  title = "Insights da IA",
  variant = "cards",
}: {
  mode: "campaigns" | "organic" | "common-posts";
  businessType: string;
  data: unknown;
  fallback?: React.ReactNode;
  title?: string;
  variant?: "cards" | "list";
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, businessType, data }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((json) => {
        const list = (json.insights ?? []) as Insight[];
        if (list.length === 0) throw new Error("empty");
        setInsights(list);
        setState("ok");
      })
      .catch(() => setState("error"))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [mode, businessType, data]);

  if (state === "loading") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-brand-300" /> {title}
        </div>
        <div className={cn(variant === "list" ? "space-y-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2")}>
          {[0, 1].map((i) => (
            <Card key={i} className="animate-pulse p-4">
              <div className="h-3 w-20 rounded bg-subtle-strong" />
              <div className="mt-2 h-4 w-3/4 rounded bg-subtle-strong" />
              <div className="mt-2 h-3 w-full rounded bg-subtle" />
              <div className="mt-1 h-3 w-5/6 rounded bg-subtle" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return <>{fallback ?? null}</>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Sparkles className="h-4 w-4 text-brand-300" /> {title}
      </div>
      <div className={cn(variant === "list" ? "space-y-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2")}>
        {insights.map((ins, i) => {
          const s = STYLE[ins.type] ?? STYLE.padrao;
          const Icon = s.icon;
          return (
            <Card key={i} className="p-4">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.chip)}>
                <Icon className="h-3.5 w-3.5" /> {s.tag}
              </span>
              <p className="mt-2 text-sm font-semibold text-ink">{ins.title}</p>
              <p className="mt-1 text-sm text-muted">{ins.text}</p>
              {ins.action && (
                <button className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
                  {ins.action} <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
