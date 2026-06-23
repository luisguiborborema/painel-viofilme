"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function FilterTabs({
  param,
  options,
}: {
  param: string;
  options: { label: string; value: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? options[0]?.value;

  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map((opt) => {
        const params = new URLSearchParams(searchParams.toString());
        if (opt.value === options[0].value) params.delete(param);
        else params.set(param, opt.value);
        const href = `${pathname}${params.toString() ? `?${params}` : ""}`;
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-500 text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
