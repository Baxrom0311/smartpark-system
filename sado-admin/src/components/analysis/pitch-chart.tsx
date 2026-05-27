/**
 * Pitch (f0) line chart for one recording.
 *
 * The backend ships `pitch_data.f0_hz` as a list of values, one per
 * 25ms frame (40 fps). We render it as a smooth line with frame index
 * on the x-axis and Hz on the y-axis; useful for spotting monotony,
 * jitter, or unusually low/high voicing.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PitchData } from "@/types";

interface PitchChartProps {
  data: PitchData;
  ariaLabel: string;
}

export function PitchChart({ data, ariaLabel }: PitchChartProps) {
  const chartData = useMemo(
    () =>
      data.f0_hz.map((hz, idx) => ({
        frame: idx,
        f0: hz,
      })),
    [data.f0_hz],
  );

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
            domain={["auto", "auto"]}
            unit=" Hz"
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)} Hz`, "f0"]}
            labelFormatter={(label: number) => `frame ${label}`}
          />
          <ReferenceLine
            y={data.f0_mean}
            stroke="oklch(0.58 0.18 250)"
            strokeDasharray="4 4"
            label={{
              value: `mean ${data.f0_mean.toFixed(0)}`,
              fontSize: 11,
              position: "insideTopRight",
            }}
          />
          <Line
            type="monotone"
            dataKey="f0"
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
