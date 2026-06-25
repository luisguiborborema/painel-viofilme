"use client";

import { Card } from "@/components/ui/card";
import { MultiBarChart } from "@/components/dashboard/charts";
import type { CplMonthPoint } from "@/lib/data/types";

const META = "#38bdf8";
const GOOGLE = "#34d399";

export function CplBarCard({ data }: { data: CplMonthPoint[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          CPL mês a mês — últimos 4 meses
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: META }}
            />
            Meta Ads
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: GOOGLE }}
            />
            Google Ads
          </span>
        </div>
      </div>
      <MultiBarChart
        data={data}
        categoryKey="month"
        currency
        theme="dark"
        height={240}
        series={[
          { key: "meta", color: META, name: "Meta Ads" },
          { key: "google", color: GOOGLE, name: "Google Ads" },
        ]}
      />
    </Card>
  );
}
