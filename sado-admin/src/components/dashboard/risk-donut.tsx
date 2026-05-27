import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RiskDonutProps {
  green: number;
  yellow: number;
  red: number;
  loading?: boolean;
}

const COLORS = {
  green: "oklch(0.7 0.18 145)",
  yellow: "oklch(0.82 0.17 90)",
  red: "oklch(0.62 0.22 25)",
};

export function RiskDonut({ green, yellow, red, loading }: RiskDonutProps) {
  const { t } = useTranslation();

  const data = [
    { name: t("risk.green"), value: green, fill: COLORS.green },
    { name: t("risk.yellow"), value: yellow, fill: COLORS.yellow },
    { name: t("risk.red"), value: red, fill: COLORS.red },
  ];

  const isEmpty = !loading && green + yellow + red === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.riskDistribution")}</CardTitle>
        <CardDescription>
          {t("risk.green")} · {t("risk.yellow")} · {t("risk.red")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {loading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : isEmpty ? (
            <div className="flex h-full items-center justify-center text-sm text-brand-500">
              {t("dashboard.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend verticalAlign="bottom" height={28} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
