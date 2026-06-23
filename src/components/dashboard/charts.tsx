"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/utils";

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function TrendAreaChart({
  data,
  dataKey,
  color = "#2a63c9",
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: "#667085" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: "#667085" }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => formatCompact(Number(v))}
          labelFormatter={(label) => shortDate(String(label))}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e7e9ee",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#grad-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data,
  dataKey,
  labelKey,
  color = "#2a63c9",
}: {
  data: { [k: string]: number | string }[];
  dataKey: string;
  labelKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#eef0f4"
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: "#667085" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fontSize: 12, fill: "#14171f" }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          formatter={(v) => formatCompact(Number(v))}
          cursor={{ fill: "#f5f6f8" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e7e9ee",
            fontSize: 12,
          }}
        />
        <Bar dataKey={dataKey} radius={[0, 8, 8, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} opacity={Math.max(0.4, 1 - i * 0.12)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
