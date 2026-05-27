/**
 * Assessment results screen.
 *
 * Polls `/analysis/:assessment_id` until the backend marks the
 * assessment as `completed` (or `failed`). Once we have a final risk
 * level we render a child-friendly explanation and a CTA back to the
 * home screen.
 *
 * Polling is bounded — TanStack Query stops when status is in a
 * terminal state. When the assessment reaches `completed` we also
 * fire `scheduleNextAssessmentReminder` so the parent's chosen
 * cadence is respected without forcing them to open the Settings
 * screen. The scheduler is idempotent: it dedupes on `assessmentId`,
 * skips when reminders are disabled in preferences, and never
 * prompts the user for permission.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAnalysis } from "@/services/assessments";
import { getChild } from "@/services/children";
import {
  scheduleNextAssessmentReminder,
  type ScheduleNextAssessmentResult,
} from "@/services/reminder-scheduler";
import { useAssessmentStore } from "@/stores/assessment-store";
import type { AssessmentAnalysis, RiskLevel } from "@/types";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

function explanationKey(risk: RiskLevel | null): string {
  if (risk === "green") return "results.explanationGreen";
  if (risk === "yellow") return "results.explanationYellow";
  if (risk === "red") return "results.explanationRed";
  return "results.loading";
}

function riskLabelKey(risk: RiskLevel | null): string {
  if (risk === "green") return "risk.green";
  if (risk === "yellow") return "risk.yellow";
  if (risk === "red") return "risk.red";
  return "risk.pending";
}

export default function AssessmentResultsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const assessment = useAssessmentStore((state) => state.assessment);
  const childId = useAssessmentStore((state) => state.childId);
  const reset = useAssessmentStore((state) => state.reset);
  const [reminderResult, setReminderResult] =
    useState<ScheduleNextAssessmentResult | null>(null);
  const scheduledForAssessmentRef = useRef<string | null>(null);

  const analysisQuery = useQuery<AssessmentAnalysis>({
    queryKey: ["analysis", assessment?.id ?? ""],
    enabled: assessment != null,
    queryFn: () => {
      if (!assessment) throw new Error("no_active_assessment");
      return getAnalysis(assessment.id);
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return TERMINAL_STATUSES.has(data.status) ? false : 2000;
    },
  });

  const analysis = analysisQuery.data;
  const isPolling =
    analysis == null || !TERMINAL_STATUSES.has(analysis.status);

  // Auto-schedule the next assessment reminder once the analysis
  // resolves to `completed`. The scheduler itself is idempotent for
  // a given assessmentId, but we additionally guard with a ref so we
  // don't fire a redundant async call on every refetch.
  useEffect(() => {
    if (!analysis || !assessment) return;
    if (analysis.status !== "completed") return;
    if (scheduledForAssessmentRef.current === assessment.id) return;
    scheduledForAssessmentRef.current = assessment.id;

    const titleTemplate = t("notifications.reminderTitle");
    const bodyTemplate = t("notifications.reminderBody");
    const targetChildId = childId ?? null;

    void (async (): Promise<void> => {
      try {
        let childName = t("results.defaultChildName");
        if (targetChildId) {
          try {
            const child = await getChild(targetChildId);
            childName = child.name;
          } catch {
            // Network/permission failure resolving the child name is
            // not fatal — fall back to the localised default.
          }
        }
        const result = await scheduleNextAssessmentReminder({
          assessmentId: assessment.id,
          childId: targetChildId ?? "unknown",
          childName,
          titleTemplate,
          bodyTemplate,
        });
        setReminderResult(result);
      } catch {
        // Notification scheduling is a progressive enhancement —
        // never block the results UI.
        setReminderResult({
          status: "skipped",
          reason: "scheduling-failed",
          preferences: {
            enabled: false,
            frequency: "weekly",
            lastScheduledAt: null,
            lastScheduledAssessmentId: null,
          },
        });
      }
    })();
  }, [analysis, assessment, childId, t]);

  const overall: RiskLevel | null = analysis?.overall_risk ?? null;
  const confidencePercent = useMemo(() => {
    if (analysis?.overall_confidence == null) return null;
    return Math.round(analysis.overall_confidence * 100);
  }, [analysis?.overall_confidence]);

  const reminderMessage = useMemo<string | null>(() => {
    if (!reminderResult) return null;
    if (reminderResult.status === "scheduled") {
      return t("results.nextReminderScheduled", {
        date: reminderResult.scheduledFor.toLocaleDateString(),
      });
    }
    if (reminderResult.reason === "already-scheduled") {
      const iso = reminderResult.preferences.lastScheduledAt;
      if (iso) {
        try {
          return t("results.nextReminderScheduled", {
            date: new Date(iso).toLocaleDateString(),
          });
        } catch {
          return null;
        }
      }
      return null;
    }
    if (reminderResult.reason === "reminders-disabled") {
      return t("results.remindersDisabledHint");
    }
    if (reminderResult.reason === "permission-denied") {
      return t("results.remindersPermissionHint");
    }
    return null;
  }, [reminderResult, t]);

  const handleHome = (): void => {
    reset();
    router.replace("/(parent)");
  };

  if (assessment == null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-base text-neutral-700">
          {t("results.noResults")}
        </Text>
        <View className="mt-4 px-6">
          <Button
            label={t("results.backHome")}
            onPress={handleHome}
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <Text className="text-2xl font-bold text-primary-700">
          {t("results.title")}
        </Text>

        <Card variant="elevated" padding="lg" className="mt-6">
          <Text className="text-sm text-neutral-500">{t("results.overall")}</Text>
          <View className="mt-3 flex-row items-center gap-3">
            {overall ? (
              <Badge tone={overall} size="md" label={t(riskLabelKey(overall))} />
            ) : (
              <Badge tone="neutral" size="md" label={t("risk.pending")} />
            )}
            {confidencePercent != null ? (
              <Text className="text-sm text-neutral-600">
                {t("results.confidence", { percent: confidencePercent })}
              </Text>
            ) : null}
          </View>

          {isPolling ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-sm text-neutral-600">
                {t("results.loading")}
              </Text>
            </View>
          ) : (
            <Text className="mt-4 text-sm text-neutral-700">
              {t(explanationKey(overall))}
            </Text>
          )}

          {reminderMessage ? (
            <View
              accessibilityRole="alert"
              className="mt-4 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2"
            >
              <Text className="text-sm font-medium text-primary-700">
                {reminderMessage}
              </Text>
            </View>
          ) : null}
        </Card>

        {analysis && analysis.results.length > 0 ? (
          <View className="mt-6 gap-3">
            <Text className="text-base font-semibold text-neutral-900">
              {t("results.tasks")}
            </Text>
            {analysis.results.map((row) => (
              <Card key={row.recording_id} variant="outline" padding="md">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-neutral-800">
                    {row.transcript ?? "—"}
                  </Text>
                  <Badge
                    tone={row.risk_level}
                    label={t(riskLabelKey(row.risk_level))}
                  />
                </View>
                <Text className="mt-1 text-xs text-neutral-500">
                  {`${Math.round(row.confidence * 100)}%`}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        <View className="mt-8">
          <Button
            label={t("results.backHome")}
            size="lg"
            onPress={handleHome}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
