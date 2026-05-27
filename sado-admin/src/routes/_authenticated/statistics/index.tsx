import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRegionalStats } from "@/hooks/queries/use-stats";
import { WeeklyLine } from "@/components/dashboard/weekly-line";

export const Route = createFileRoute("/_authenticated/statistics/")({
  component: StatisticsPage,
});

function StatisticsPage() {
  const { t } = useTranslation();
  const stats = useRegionalStats();
  const data = stats.data;
  const loading = stats.isLoading;

  const regionChartData = (data?.regions ?? []).map((r) => ({
    name: r.region_name,
    green: r.risk_distribution.green,
    yellow: r.risk_distribution.yellow,
    red: r.risk_distribution.red,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("statistics.title")}
        description={t("statistics.description")}
      />

      {stats.isError && (
        <div
          role="alert"
          className="rounded-md border border-risk-red/30 bg-risk-red/10 px-4 py-3 text-sm text-risk-red"
        >
          {t("common.error")}:{" "}
          {stats.error instanceof Error
            ? stats.error.message
            : t("errors.server")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("statistics.byRegion")}</CardTitle>
            <CardDescription>{t("statistics.byRegionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {loading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : regionChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-brand-500">
                  {t("dashboard.noData")}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.88 0.04 250)"
                    />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="green"
                      stackId="a"
                      fill="oklch(0.7 0.18 145)"
                      name={t("risk.green")}
                    />
                    <Bar
                      dataKey="yellow"
                      stackId="a"
                      fill="oklch(0.82 0.17 90)"
                      name={t("risk.yellow")}
                    />
                    <Bar
                      dataKey="red"
                      stackId="a"
                      fill="oklch(0.62 0.22 25)"
                      name={t("risk.red")}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <WeeklyLine data={data?.daily_trend ?? []} loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("statistics.kindergartensTable")}</CardTitle>
          <CardDescription>
            {t("statistics.kindergartensTableDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (data?.kindergartens ?? []).length === 0 ? (
            <p className="text-sm text-brand-500">{t("dashboard.noData")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("kindergartens.name")}</TableHead>
                  <TableHead>{t("kindergartens.region")}</TableHead>
                  <TableHead>{t("kindergartens.children")}</TableHead>
                  <TableHead>{t("statistics.assessments")}</TableHead>
                  <TableHead>{t("risk.green")}</TableHead>
                  <TableHead>{t("risk.yellow")}</TableHead>
                  <TableHead>{t("risk.red")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.kindergartens ?? []).map((kg) => (
                  <TableRow key={kg.kindergarten_id}>
                    <TableCell className="font-medium">{kg.name}</TableCell>
                    <TableCell>{kg.region_name ?? "—"}</TableCell>
                    <TableCell>{kg.child_count}</TableCell>
                    <TableCell>{kg.assessments}</TableCell>
                    <TableCell className="text-risk-green">
                      {kg.green_count}
                    </TableCell>
                    <TableCell className="text-risk-yellow">
                      {kg.yellow_count}
                    </TableCell>
                    <TableCell className="text-risk-red">
                      {kg.red_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
