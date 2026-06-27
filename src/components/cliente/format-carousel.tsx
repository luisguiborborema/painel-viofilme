"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DonutChart } from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";

export type FormatSlide = {
  title: string;
  items: { name: string; value: number; color: string }[];
  insight: string;
};

export function FormatCarousel({ slides }: { slides: FormatSlide[] }) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const leader = [...slide.items].sort((a, b) => b.value - a.value)[0];

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{slide.title}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setI((v) => (v - 1 + slides.length) % slides.length)}
            className="rounded-lg p-1 text-muted hover:text-ink"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setI((v) => (v + 1) % slides.length)}
            className="rounded-lg p-1 text-muted hover:text-ink"
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <DonutChart data={slide.items} height={180} />
        {leader && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink">{leader.value}%</span>
            <span className="text-xs text-muted">{leader.name}</span>
          </div>
        )}
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {slide.items.map((it) => (
          <li key={it.name} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
            {it.name} {it.value}%
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">{slide.insight}</p>

      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Slide ${idx + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === i ? "w-5 bg-brand-500" : "w-1.5 bg-subtle-strong",
            )}
          />
        ))}
      </div>
    </Card>
  );
}
