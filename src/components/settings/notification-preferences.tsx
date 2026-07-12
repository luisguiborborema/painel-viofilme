"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoriesForRole, type NotifCategory } from "@/lib/notify-categories";
import type { Role } from "@/lib/auth/types";

/** Preferências por categoria: silenciar tipos de aviso (push + sininho). */
export function NotificationPreferences({
  role,
  initialMuted,
}: {
  role: Role;
  initialMuted: string[];
}) {
  const cats = categoriesForRole(role);
  const [muted, setMuted] = useState<Set<string>>(() => new Set(initialMuted));
  const [saving, setSaving] = useState(false);

  async function toggle(key: NotifCategory) {
    const next = new Set(muted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setMuted(next);
    setSaving(true);
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: [...next] }),
    }).catch(() => {});
    setSaving(false);
  }

  if (!cats.length) return null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted">
          Tipos de aviso (valem para push e para o sininho)
        </p>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
      </div>
      <div className="divide-y divide-line/60">
        {cats.map((c) => {
          const on = !muted.has(c.key); // ligado = não silenciado
          return (
            <div key={c.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{c.label}</p>
                <p className="text-xs text-muted">{c.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(c.key)}
                role="switch"
                aria-checked={on}
                title={on ? "Receber" : "Silenciado"}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                  on ? "bg-brand-600" : "bg-line",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    on ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
