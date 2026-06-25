"use client";

import { Card } from "@/components/ui/card";
import { DonutChart } from "@/components/dashboard/charts";
import type { FormatReach } from "@/lib/data/types";

export function FormatDonutCard({ data }: { data: FormatReach }) {
  const items = [
    { name: "Reels", value: data.reels, color: "#34d399" },
    { name: "Feed", value: data.feed, color: "#6366f1" },
    { name: "Stories", value: data.stories, color: "#f59e0b" },
    { name: "Carrossel", value: data.carousel, color: "#f472b6" },
  ];

  return (
    <Card className="p-5">
      <h2 className="mb-2 text-sm font-semibold text-ink">
        Alcance por tipo de conteúdo
      </h2>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
        <DonutChart data={items} theme="dark" height={200} />
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-muted">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: it.color }}
                />
                {it.name}
              </span>
              <span className="font-semibold text-ink">{it.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
