"use client";

/**
 * Fronteira de code-splitting dos gráficos.
 *
 * O recharts é pesado (~384 KB / ~110 KB gzip, chunk próprio). Importado
 * estaticamente, esse chunk baixava junto com a página e travava a hidratação
 * na troca de aba. Aqui reexportamos cada gráfico via `next/dynamic` com
 * `ssr: false`: a página pinta imediatamente (skeleton no lugar do gráfico) e o
 * recharts carrega logo depois, quando o card monta. As implementações reais
 * ficam intactas em `./charts-impl`. Os consumidores continuam importando os
 * mesmos nomes de `@/components/dashboard/charts` — nada muda para eles.
 */
import dynamic from "next/dynamic";

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-subtle"
      style={{ height }}
      aria-hidden
    />
  );
}

export const TrendAreaChart = dynamic(
  () => import("./charts-impl").then((m) => m.TrendAreaChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export const MultiLineChart = dynamic(
  () => import("./charts-impl").then((m) => m.MultiLineChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const ComboMrrChart = dynamic(
  () => import("./charts-impl").then((m) => m.ComboMrrChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

export const DonutChart = dynamic(
  () => import("./charts-impl").then((m) => m.DonutChart),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> },
);

export const Sparkline = dynamic(
  () => import("./charts-impl").then((m) => m.Sparkline),
  { ssr: false, loading: () => <ChartSkeleton height={44} /> },
);

export const MultiBarChart = dynamic(
  () => import("./charts-impl").then((m) => m.MultiBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const SimpleBarChart = dynamic(
  () => import("./charts-impl").then((m) => m.SimpleBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);
