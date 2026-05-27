/**
 * Formant trajectory line chart (F1, F2, F3 stacked on the same plot).
 *
 * The backend exposes three parallel series at 25ms hop. F1 reflects
 * vowel openness, F2 vowel frontness, and F3 lip rounding — useful
 * heuristics for therapists screening articulation.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FormantData } from "@/types";

interface FormantChartProps {
  data: FormantData;
  ariaLabel: string;
}

export function FormantChart({ data, ariaLabel }: FormantChartProps) {
  const chartData = useMemo(() => {
    const len = Math.min(
      data.tracks.f1.length,
      data.tracks.f2.length,
      data.tracks.f3.length,
    );
    return Array.from({ length: len }, (_, idx) => ({
      frame: idx,
      f1: data.tracks.f1[idx],
      f2: data.tracks.f2[idx],
      f3: data.tracks.f3[idx],
    }));
  }, [data.tracks.f1, data.tracks.f2, data.tracks.f3]);

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
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.04 250)" />
          <XAxis
            dataKey="frame"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            unit=" Hz"
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${Math.round(value)} Hz`,
              name.toUpperCase(),
            ]}
            labelFormatter={(label: number) => `frame ${label}`}
          />
          <Legend verticalAlign="top" height={28} />
          <Line
            type="monotone"
            dataKey="f1"
            stroke="oklch(0.7 0.18 145)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="f2"
            stroke="oklch(0.82 0.17 90)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="f3"
            stroke="oklch(0.62 0.22 25)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
