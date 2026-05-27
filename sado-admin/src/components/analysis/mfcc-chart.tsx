/**
 * MFCC summary chart — bar chart of per-coefficient mean ± std.
 *
 * Rendering the full N×F matrix as a heatmap would require a custom
 * SVG component (Recharts has no heatmap primitive). The mean/std bar
 * chart captures the essential shape — flat MFCC means typically
 * indicate monotonic / muffled speech, large stds indicate noisy or
 * highly variable articulation.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MfccFeatures } from "@/types";

interface MfccChartProps {
  data: MfccFeatures;
  ariaLabel: string;
}

export function MfccChart({ data, ariaLabel }: MfccChartProps) {
  const chartData = useMemo(() => {
    const len = Math.min(data.mean.length, data.std.length || data.mean.length);
    return Array.from({ length: len }, (_, idx) => ({
      coeff: `c${idx}`,
      mean: data.mean[idx] ?? 0,
      std: data.std[idx] ?? 0,
    }));
  }, [data.mean, data.std]);

  if (chartData.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-48 items-center justify-center text-sm text-brand-500"
      >
        —
      </div>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.04 250)" />
          <XAxis
            dataKey="coeff"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name,
            ]}
          />
          <Bar
            dataKey="mean"
            fill="oklch(0.58 0.18 250)"
            isAnimationActive={false}
          >
            <ErrorBar
              dataKey="std"
              width={4}
              stroke="oklch(0.42 0.05 250)"
              strokeWidth={1.5}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
