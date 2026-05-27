import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types";

const variantByLevel = {
  green: "risk-green",
  yellow: "risk-yellow",
  red: "risk-red",
} as const;

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  return <Badge variant={variantByLevel[level]}>{t(`risk.${level}`)}</Badge>;
}
