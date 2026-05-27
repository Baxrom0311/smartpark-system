/**
 * Risk-aware Badge — small pill displaying status (green/yellow/red)
 * or a neutral tone. Used on assessment results and child cards.
 */

import { Text, View } from "react-native";

import type { RiskLevel } from "@/types";

export type BadgeTone = RiskLevel | "neutral" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  label: string;
  size?: "sm" | "md";
}

const toneClass: Record<BadgeTone, string> = {
  green: "bg-risk-green/15 border-risk-green",
  yellow: "bg-risk-yellow/15 border-risk-yellow",
  red: "bg-risk-red/15 border-risk-red",
  neutral: "bg-neutral-100 border-neutral-300",
  info: "bg-primary-100 border-primary-500",
};

const labelClass: Record<BadgeTone, string> = {
  green: "text-risk-green",
  yellow: "text-risk-yellow",
  red: "text-risk-red",
  neutral: "text-neutral-700",
  info: "text-primary-700",
};

export function Badge({
  tone = "neutral",
  label,
  size = "sm",
}: BadgeProps): React.ReactElement {
  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  const text = size === "sm" ? "text-xs" : "text-sm";
  return (
    <View
      className={`self-start rounded-full border ${padding} ${toneClass[tone]}`}
    >
      <Text className={`font-semibold ${text} ${labelClass[tone]}`}>
        {label}
      </Text>
    </View>
  );
}
