"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/utils";

type ChartTheme = "light" | "dark";

function palette(theme: ChartTheme) {
  return theme === "dark"
    ? {
        grid: "#232a33",
        tick: "#8b929c",
        catTick: "#f2f4f7",
        cursor: "#1b212a",
        tooltipBg: "#14181f",
        tooltipBorder: "#232a33",
        tooltipText: "#f2f4f7",
      }
    : {
        grid: "#eef0f4",
        tick: "#667085",
        catTick: "#14171f",
        cursor: "#f5f6f8",
        tooltipBg: "#ffffff",
        tooltipBorder: "#e7e9ee",
        tooltipText: "#14171f",
      };
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function TrendAreaChart({
  data,
  dataKey,
  color = "#2a63c9",
  theme = "light",
  valueFormatter = (v: number) => formatCompact(v),
  height = 260,
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  color?: string;
  theme?: ChartTheme;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const c = palette(theme);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => valueFormatter(Number(v))}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => valueFormatter(Number(v))}
          labelFormatter={(label) => shortDate(String(label))}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
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

export function MultiLineChart({
  data,
  categoryKey,
  series,
  theme = "light",
  height = 240,
}: {
  data: { [k: string]: number | string }[];
  categoryKey: string;
  series: { key: string; color: string; name: string }[];
  theme?: ChartTheme;
  height?: number;
}) {
  const c = palette(theme);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey={categoryKey}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => formatCompact(Number(v))}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
            fontSize: 12,
          }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComboMrrChart({
  data,
  theme = "light",
  barColor = "#38bdf8",
  lineColor = "#34d399",
  height = 260,
}: {
  data: { month: string; mrr: number; novos: number }[];
  theme?: ChartTheme;
  barColor?: string;
  lineColor?: string;
  height?: number;
}) {
  const c = palette(theme);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) => `R$ ${formatCompact(Number(v))}`}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          formatter={(v, name) =>
            name === "MRR" ? `R$ ${formatCompact(Number(v))}` : `${v} novos`
          }
          cursor={{ fill: c.cursor }}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
            fontSize: 12,
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="mrr"
          name="MRR"
          fill={barColor}
          radius={[4, 4, 0, 0]}
          maxBarSize={34}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="novos"
          name="Novos clientes"
          stroke={lineColor}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  theme = "light",
  height = 220,
}: {
  data: { name: string; value: number; color: string }[];
  theme?: ChartTheme;
  height?: number;
}) {
  const c = palette(theme);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => `${v}%`}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  dataKey = "v",
  color = "#34d399",
  height = 44,
}: {
  data: { [k: string]: number }[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MultiBarChart({
  data,
  categoryKey,
  series,
  theme = "light",
  currency = false,
  height = 240,
}: {
  data: { [k: string]: number | string }[];
  categoryKey: string;
  series: { key: string; color: string; name: string }[];
  theme?: ChartTheme;
  currency?: boolean;
  height?: number;
}) {
  const c = palette(theme);
  const fmt = (v: number) =>
    currency ? `R$ ${v.toLocaleString("pt-BR")}` : formatCompact(v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey={categoryKey}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => fmt(Number(v))}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v) => fmt(Number(v))}
          cursor={{ fill: c.cursor }}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
            fontSize: 12,
          }}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data,
  dataKey,
  labelKey,
  color = "#2a63c9",
  theme = "light",
}: {
  data: { [k: string]: number | string }[];
  dataKey: string;
  labelKey: string;
  color?: string;
  theme?: ChartTheme;
}) {
  const c = palette(theme);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: c.tick }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fontSize: 12, fill: c.catTick }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          formatter={(v) => formatCompact(Number(v))}
          cursor={{ fill: c.cursor }}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${c.tooltipBorder}`,
            background: c.tooltipBg,
            color: c.tooltipText,
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
