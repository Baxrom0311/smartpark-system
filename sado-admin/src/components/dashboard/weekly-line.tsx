import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

interface WeeklyLineProps {
  data: ReadonlyArray<{ date: string; count: number }>;
  loading?: boolean;
}

export function WeeklyLine({ data, loading }: WeeklyLineProps) {
  const { t } = useTranslation();
  const isEmpty = !loading && data.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.weeklyAssessments")}</CardTitle>
        <CardDescription>{t("dashboard.assessmentsToday")}</CardDescription>
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
              <LineChart
                data={[...data]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.88 0.04 250)"
                  className="dark:stroke-brand-700"
                />
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="oklch(0.58 0.18 250)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
