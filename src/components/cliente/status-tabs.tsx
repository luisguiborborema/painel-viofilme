"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type StatusTab = { label: string; value: string; count: number };

export function StatusTabs({
  param,
  tabs,
}: {
  param: string;
  tabs: StatusTab[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? tabs[0]?.value;

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const params = new URLSearchParams(searchParams.toString());
        if (tab.value === tabs[0].value) params.delete(param);
        else params.set(param, tab.value);
        const href = `${pathname}${params.toString() ? `?${params}` : ""}`;
        const active = current === tab.value;
        const alert = tab.value === "para-aprovar";

        return (
          <Link
            key={tab.value}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-500 text-white"
                : "bg-white/5 text-muted hover:text-ink",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                active
                  ? "bg-white/25 text-white"
                  : alert && tab.count > 0
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/10 text-muted",
              )}
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
