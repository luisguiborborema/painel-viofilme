"use client";

import { useState } from "react";
import {
  Bookmark,
  DollarSign,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  Percent,
  Play,
  Share2,
  Tag,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  TrendAreaChart,
  MultiBarChart,
  MultiLineChart,
} from "@/components/dashboard/charts";
import { InfoPopover } from "@/components/dashboard/metric-info";
import { cn, formatCompact } from "@/lib/utils";

export type MetricChartType = "area" | "bar-grouped" | "line-multi" | "bar-simple";
export type MetricUnit = "currency" | "percent" | "number";
export type SeriesDef = { key: string; color: string; name: string };

export type MetricDef = {
  key: string;
  label: string;
  color: string;
  chartType: MetricChartType;
  unit?: MetricUnit;
  // exibição no card
  iconKey?: string;
  displayValue: string;
  deltaText?: string;
  delta?: number;
  invertDelta?: boolean;
  hint?: string;
  glossaryKey?: string;
  // gráfico
  chartTitle?: string;
  data: Record<string, number | string>[];
  categoryKey?: string;
  dataKey?: string;
  series?: SeriesDef[];
};

const ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  eye: Eye,
  tag: Tag,
  wallet: Wallet,
  trending: TrendingUp,
  clicks: MousePointerClick,
  target: Target,
  users: Users,
  bookmark: Bookmark,
  comment: MessageCircle,
  share: Share2,
  play: Play,
  dollar: DollarSign,
  percent: Percent,
};

function formatter(unit: MetricUnit | undefined) {
  return (n: number) => {
    if (unit === "currency") return `R$ ${formatCompact(n)}`;
    if (unit === "percent")
      return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    return formatCompact(n);
  };
}

function deltaTone(m: MetricDef): "good" | "bad" | "neutral" {
  if (m.delta === undefined) return "neutral";
  const improving = m.invertDelta ? m.delta < 0 : m.delta >= 0;
  return improving ? "good" : "bad";
}

const TONE: Record<string, string> = {
  good: "text-emerald-400",
  bad: "text-rose-400",
  neutral: "text-muted",
};

function MetricChart({ metric }: { metric: MetricDef }) {
  const fmt = formatter(metric.unit);
  const cat = metric.categoryKey ?? "date";
  const series = metric.series ?? [
    { key: metric.dataKey ?? "value", color: metric.color, name: metric.label },
  ];

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: `${metric.color}22`, color: metric.color }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: metric.color }}
          />
          {metric.chartTitle ?? metric.label}
        </span>
      </div>

      {metric.chartType === "area" && (
        <TrendAreaChart
          data={metric.data as { date: string; [k: string]: number | string }[]}
          dataKey={metric.dataKey ?? "value"}
          color={metric.color}
          valueFormatter={fmt}
          height={260}
        />
      )}
      {metric.chartType === "line-multi" && (
        <MultiLineChart data={metric.data} categoryKey={cat} series={series} height={260} />
      )}
      {(metric.chartType === "bar-grouped" || metric.chartType === "bar-simple") && (
        <MultiBarChart
          data={metric.data}
          categoryKey={cat}
          series={series}
          currency={metric.unit === "currency"}
          height={260}
        />
      )}
    </Card>
  );
}

function SelectorCard({
  metric,
  active,
  compact,
  onClick,
}: {
  metric: MetricDef;
  active: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  const Icon = metric.iconKey ? ICONS[metric.iconKey] : undefined;
  const tone = deltaTone(metric);
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border bg-surface p-4 text-left shadow-sm transition-colors",
        active ? "border-2" : "border-line hover:border-brand-300",
        compact && "min-w-[155px] shrink-0",
      )}
      style={active ? { borderColor: metric.color, background: `${metric.color}0d` } : undefined}
    >
      {active && (
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full"
          style={{ background: metric.color }}
        />
      )}
      <div className="flex items-center gap-2 text-muted">
        {Icon && !compact && <Icon className="h-4 w-4" />}
        <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {metric.label}
        </span>
        {compact && metric.glossaryKey && (
          <span className="ml-auto">
            <InfoPopover metricKey={metric.glossaryKey} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">
        {metric.displayValue}
      </div>
      {metric.deltaText ? (
        <div className={cn("mt-1 text-xs font-medium", TONE[tone])}>
          {metric.deltaText}
        </div>
      ) : (
        metric.hint && <div className="mt-1 text-xs text-muted">{metric.hint}</div>
      )}
    </button>
  );
}

export function MetricSection({
  metrics,
  defaultKey,
  layout = "grid",
  rightColumn,
}: {
  metrics: MetricDef[];
  defaultKey?: string;
  layout?: "grid" | "carousel";
  rightColumn?: React.ReactNode;
}) {
  const [selected, setSelected] = useState(defaultKey ?? metrics[0]?.key);
  const metric = metrics.find((m) => m.key === selected) ?? metrics[0];

  return (
    <div className="space-y-4">
      {layout === "carousel" ? (
        <div>
          <p className="mb-1.5 text-xs text-muted">Deslize para ver mais →</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {metrics.map((m) => (
              <SelectorCard
                key={m.key}
                metric={m}
                active={m.key === selected}
                compact
                onClick={() => setSelected(m.key)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <SelectorCard
              key={m.key}
              metric={m}
              active={m.key === selected}
              compact={false}
              onClick={() => setSelected(m.key)}
            />
          ))}
        </div>
      )}

      {rightColumn ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MetricChart metric={metric} />
          </div>
          {rightColumn}
        </div>
      ) : (
        <MetricChart metric={metric} />
      )}
    </div>
  );
}
