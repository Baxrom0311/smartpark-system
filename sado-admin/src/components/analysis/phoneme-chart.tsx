/**
 * Horizontal bar chart of phoneme accuracy scores.
 *
 * Scores are 0–1; we colour-code below/above thresholds so therapists
 * can spot weak phonemes at a glance.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PhonemeScores } from "@/types";

interface PhonemeChartProps {
  data: PhonemeScores;
  ariaLabel: string;
  weakLabel: string;
  okLabel: string;
}

const COLOR_WEAK = "oklch(0.62 0.22 25)";
const COLOR_MEDIUM = "oklch(0.82 0.17 90)";
const COLOR_OK = "oklch(0.7 0.18 145)";

function colorFor(score: number): string {
  if (score < 0.6) return COLOR_WEAK;
  if (score < 0.8) return COLOR_MEDIUM;
  return COLOR_OK;
}

export function PhonemeChart({ data, ariaLabel }: PhonemeChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data.scores)
      .map(([phoneme, score]) => ({ phoneme, score }))
      .sort((a, b) => a.score - b.score);
  }, [data.scores]);

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

  // Tall enough that ~13 rows fit comfortably.
  const height = Math.max(220, chartData.length * 24 + 40);

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.04 250)" />
          <XAxis
            type="number"
            domain={[0, 1]}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <YAxis
            type="category"
            dataKey="phoneme"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [
              `${(value * 100).toFixed(0)}%`,
              "score",
            ]}
            labelFormatter={(label: string) => `/${label}/`}
          />
          <Bar dataKey="score" isAnimationActive={false}>
            {chartData.map((entry) => (
              <Cell key={entry.phoneme} fill={colorFor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
