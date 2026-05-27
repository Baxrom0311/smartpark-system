import { createFileRoute } from "@tanstack/react-router";
import { Activity, Baby, AlertTriangle, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RiskDonut } from "@/components/dashboard/risk-donut";
import { WeeklyLine } from "@/components/dashboard/weekly-line";
import { StatCard } from "@/components/shared/stat-card";
import { useSystemStats } from "@/hooks/queries/use-stats";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const stats = useSystemStats();
  const data = stats.data;
  const loading = stats.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-brand-50">
          {t("dashboard.title")}
        </h1>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.totalChildren")}
          value={data?.total_children ?? 0}
          icon={Baby}
          loading={loading}
        />
        <StatCard
          label={t("dashboard.assessmentsToday")}
          value={data?.assessments_today ?? 0}
          icon={Activity}
          loading={loading}
          variant="success"
        />
        <StatCard
          label={t("dashboard.redRiskPct")}
          value={
            data ? `${(data.red_risk_pct ?? 0).toFixed(1)}%` : "0.0%"
          }
          icon={AlertTriangle}
          loading={loading}
          variant="danger"
        />
        <StatCard
          label={t("dashboard.activeTherapists")}
          value={data?.active_therapists ?? 0}
          icon={Stethoscope}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RiskDonut
          green={data?.green_risk_pct ?? 0}
          yellow={data?.yellow_risk_pct ?? 0}
          red={data?.red_risk_pct ?? 0}
          loading={loading}
        />
        <WeeklyLine
          data={data?.weekly_assessments ?? []}
          loading={loading}
        />
      </div>
    </div>
  );
}
