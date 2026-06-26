"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrendAreaChart } from "@/components/dashboard/charts";
import type { EngagementPoint } from "@/lib/data/types";

export function EngagementCard({ series }: { series: EngagementPoint[] }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Engajamento — últimos 30 dias
        </h2>
        <Link
          href="/cliente/resultados"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
        >
          Ver detalhes <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <TrendAreaChart
        data={series}
        dataKey="value"
        color="#34d399"
        height={220}
        valueFormatter={(v) =>
          `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
        }
      />
    </Card>
  );
}
