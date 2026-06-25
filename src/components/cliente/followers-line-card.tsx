"use client";

import { Card } from "@/components/ui/card";
import { MultiLineChart } from "@/components/dashboard/charts";
import type { FollowersMonthPoint } from "@/lib/data/types";

const IG = "#f472b6";
const FB = "#60a5fa";

export function FollowersLineCard({ data }: { data: FollowersMonthPoint[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Crescimento de seguidores — últimos 6 meses
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: IG }} />
            Instagram
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FB }} />
            Facebook
          </span>
        </div>
      </div>
      <MultiLineChart
        data={data}
        categoryKey="month"
        theme="dark"
        height={240}
        series={[
          { key: "instagram", color: IG, name: "Instagram" },
          { key: "facebook", color: FB, name: "Facebook" },
        ]}
      />
    </Card>
  );
}
