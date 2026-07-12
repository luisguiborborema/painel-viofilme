"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";

type Note = {
  id: string;
  title: string;
  body?: string | null;
  url?: string | null;
  read: boolean;
  created_at: string;
};

/** Sininho de notificações in-app: badge de não-lidas + lista + marcar lida. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (res) {
      setItems(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    }).catch(() => {});
  }

  async function openItem(n: Note) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id: n.id }),
      }).catch(() => {});
    }
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-canvas"
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">Notificações</span>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Check className="h-3.5 w-3.5" /> Marcar todas
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Sem notificações.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full gap-2.5 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-subtle",
                      !n.read && "bg-brand-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-brand-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-muted">
                        {dayMonth(n.created_at)} {clockLabel(n.created_at)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
