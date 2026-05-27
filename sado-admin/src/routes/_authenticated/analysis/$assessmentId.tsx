/**
 * Therapist / admin deep-dive analysis page.
 *
 * Path: `/analysis/$assessmentId`
 *
 * Pulls `GET /analysis/{id}/detailed` which returns one
 * `AnalysisDetailed` row per audio recording in the assessment with
 * the raw acoustic features (MFCC matrix, pitch f0 series, formant
 * tracks, phoneme scores). Visualises each feature group with a
 * dedicated Recharts chart.
 *
 * Access control:
 *  - The endpoint is server-side guarded for therapist + admin only.
 *  - This route additionally pre-checks the role in `beforeLoad` and
 *    redirects to the dashboard so non-privileged users never see a
 *    forbidden splash. Sidebars / detail pages also hide the link.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FormantChart } from "@/components/analysis/formant-chart";
import { MfccChart } from "@/components/analysis/mfcc-chart";
import { PhonemeChart } from "@/components/analysis/phoneme-chart";
import { PitchChart } from "@/components/analysis/pitch-chart";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysisDetailed } from "@/hooks/queries/use-analysis";
import { ApiClientError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { AnalysisDetailed, RiskLevel } from "@/types";

const PRIVILEGED_ROLES = new Set(["therapist", "admin"]);

export const Route = createFileRoute("/_authenticated/analysis/$assessmentId")({
  beforeLoad: () => {
    const { user, status } = useAuthStore.getState();
    // While bootstrapping the layout shows a loader; only redirect
    // once we've confirmed the user is authenticated.
    if (status !== "authenticated" || !user) return;
    if (!PRIVILEGED_ROLES.has(user.role)) {
      throw redirect({ to: "/" });
    }
  },
  component: AnalysisDetailPage,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function AnalysisDetailPage() {
  const { assessmentId } = Route.useParams();
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const query = useAnalysisDetailed(assessmentId);

  // Belt-and-braces — a non-privileged user visiting via direct URL
  // hits this branch because beforeLoad runs once on first navigation
  // and the role might have changed.
  if (me && !PRIVILEGED_ROLES.has(me.role)) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Card>
          <CardContent className="p-6 text-sm text-risk-red">
            {t("errors.forbidden")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (query.isLoading) return <AnalysisSkeleton />;

  if (query.isError) {
    const message =
      query.error instanceof ApiClientError && query.error.status === 404
        ? t("analysis.notFound")
        : query.error instanceof ApiClientError && query.error.status === 403
          ? t("errors.forbidden")
          : (query.error?.message ?? t("errors.server"));
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-risk-red">
            {message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  const overallLevel = (data.overall_risk ?? null) as RiskLevel | null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <Breadcrumbs />
      <PageHeader
        title={t("analysis.title")}
        description={t("analysis.subtitle")}
        actions={
          overallLevel ? <RiskBadge level={overallLevel} /> : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("analysis.overall.title")}</CardTitle>
          <CardDescription>{t("analysis.overall.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-brand-500">{t("analysis.overall.risk")}</dt>
              <dd className="mt-1">
                {overallLevel ? (
                  <RiskBadge level={overallLevel} />
                ) : (
                  <span className="text-brand-400">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-brand-500">
                {t("analysis.overall.confidence")}
              </dt>
              <dd className="mt-1 font-medium text-brand-900 dark:text-brand-100">
                {pct(data.overall_confidence)}
              </dd>
            </div>
            <div>
              <dt className="text-brand-500">
                {t("analysis.overall.status")}
              </dt>
              <dd className="mt-1">
                <Badge variant="outline">{data.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-brand-500">
                {t("analysis.overall.completedAt")}
              </dt>
              <dd className="mt-1 font-medium text-brand-900 dark:text-brand-100">
                {formatDate(data.completed_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-brand-500">
            {t("analysis.empty")}
          </CardContent>
        </Card>
      ) : (
        data.results.map((result, idx) => (
          <RecordingAnalysis
            key={result.recording_id}
            result={result}
            index={idx + 1}
          />
        ))
      )}
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/children"
      className="inline-flex w-fit items-center gap-1 text-sm text-brand-600 hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> {t("common.back")}
    </Link>
  );
}

interface RecordingAnalysisProps {
  result: AnalysisDetailed;
  index: number;
}

function RecordingAnalysis({ result, index }: RecordingAnalysisProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold text-brand-900 dark:text-brand-100">
          {t("analysis.recording.title", { index })}
        </h2>
        <span className="font-mono text-xs text-brand-500">
          {result.recording_id}
        </span>
        <RiskBadge level={result.risk_level} />
        <span className="text-sm text-brand-500">
          {t("analysis.recording.confidence")}: {pct(result.confidence)}
        </span>
      </header>

      {result.transcript ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-900 dark:text-brand-100">
          <span className="text-xs uppercase tracking-wide text-brand-500">
            {t("analysis.recording.transcript")}:
          </span>{" "}
          {result.transcript}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("analysis.charts.pitch.title")}</CardTitle>
            <CardDescription>
              {t("analysis.charts.pitch.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.pitch_data ? (
              <PitchChart
                data={result.pitch_data}
                ariaLabel={t("analysis.charts.pitch.ariaLabel")}
              />
            ) : (
              <p className="text-sm text-brand-500">
                {t("analysis.charts.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analysis.charts.formants.title")}</CardTitle>
            <CardDescription>
              {t("analysis.charts.formants.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.formant_data ? (
              <FormantChart
                data={result.formant_data}
                ariaLabel={t("analysis.charts.formants.ariaLabel")}
              />
            ) : (
              <p className="text-sm text-brand-500">
                {t("analysis.charts.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analysis.charts.mfcc.title")}</CardTitle>
            <CardDescription>{t("analysis.charts.mfcc.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {result.mfcc_features ? (
              <MfccChart
                data={result.mfcc_features}
                ariaLabel={t("analysis.charts.mfcc.ariaLabel")}
              />
            ) : (
              <p className="text-sm text-brand-500">
                {t("analysis.charts.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("analysis.charts.phonemes.title")}</CardTitle>
            <CardDescription>
              {t("analysis.charts.phonemes.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.phoneme_scores ? (
              <PhonemeChart
                data={result.phoneme_scores}
                ariaLabel={t("analysis.charts.phonemes.ariaLabel")}
                weakLabel={t("analysis.charts.phonemes.weak")}
                okLabel={t("analysis.charts.phonemes.ok")}
              />
            ) : (
              <p className="text-sm text-brand-500">
                {t("analysis.charts.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    </div>
  );
}
