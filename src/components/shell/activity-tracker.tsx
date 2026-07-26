"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Registra a navegação (page-view) a cada troca de rota. Best-effort. */
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
