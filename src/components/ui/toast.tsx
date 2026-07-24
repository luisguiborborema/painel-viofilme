"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "error" | "success";
type ToastItem = { id: number; message: string; kind: ToastKind };
type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let counter = 0;

/**
 * Toast global chamável de qualquer lugar (não precisa de hook). Usado para
 * NÃO deixar falhas de save passarem silenciosas — a causa da classe de bug
 * "sumiu sem avisar".
 */
export function toast(message: string, kind: ToastKind = "error") {
  counter += 1;
  const item = { id: counter, message, kind };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 6000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  function dismiss(id: number) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm shadow-lg",
            t.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
