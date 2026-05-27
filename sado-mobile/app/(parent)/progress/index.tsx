/**
 * Progress screen.
 *
 * Shows the assessment timeline for the selected child plus a small
 * weekly trend (count of completed exercises in the last 4 weeks).
 *
 * Data sources:
 *   - GET /assessments?child_id=…  → recent assessments for the chart
 *   - GET /exercises/:child_id/assignments → counts for the trend
 *
 * The chart is hand-rolled with React Native primitives so we avoid
 * pulling in heavyweight charting libraries on mobile.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listAssessments } from "@/services/assessments";
import { listAllChildren } from "@/services/children";
import { listAllChildAssignments } from "@/services/exercises";
import type { Assessment, Child, RiskLevel } from "@/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function riskTone(risk: RiskLevel | null): "green" | "yellow" | "red" | "neutral" {
  if (risk === "green") return "green";
  if (risk === "yellow") return "yellow";
  if (risk === "red") return "red";
  return "neutral";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function lastCompletedAt(assessments: readonly Assessment[]): string | null {
  for (const a of assessments) {
    if (a.completed_at) return a.completed_at;
  }
  return null;
}

interface WeekBucket {
  label: string;
  count: number;
}

function bucketCompletedAssignments(
  assignments: { completed_at: string | null }[],
): WeekBucket[] {
  const now = Date.now();
  const buckets: WeekBucket[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = now - (i + 1) * 7 * ONE_DAY_MS;
    const end = now - i * 7 * ONE_DAY_MS;
    const count = assignments.filter((a) => {
      if (!a.completed_at) return false;
      const ts = Date.parse(a.completed_at);
      if (Number.isNaN(ts)) return false;
      return ts >= start && ts < end;
    }).length;
    buckets.push({ label: `W-${i}`, count });
  }
  return buckets;
}

function ChildSelector({
  children,
  selected,
  onSelect,
}: {
  children: Child[];
  selected: string | null;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {children.map((child) => {
        const active = child.id === selected;
        return (
          <Pressable
            key={child.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(child.id)}
            className={`rounded-full border px-4 py-2 ${
              active
                ? "border-primary-600 bg-primary-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                active ? "text-primary-700" : "text-neutral-700"
              }`}
            >
              {child.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TrendChart({ buckets }: { buckets: WeekBucket[] }): React.ReactElement {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <View className="flex-row items-end justify-between gap-3" style={{ height: 120 }}>
      {buckets.map((b) => {
        const ratio = b.count / max;
        const heightPct = Math.round(Math.max(0.04, ratio) * 100);
        return (
          <View key={b.label} className="flex-1 items-center gap-1">
            <View className="w-full items-center" style={{ flex: 1 }}>
              <View className="flex-1" />
              <View
                className="w-6 rounded-md bg-primary-500"
                style={{ height: `${heightPct}%` }}
                accessibilityRole="image"
                accessibilityLabel={`${b.label}: ${b.count}`}
              />
            </View>
            <Text className="text-xs text-neutral-500">{b.label}</Text>
            <Text className="text-xs font-semibold text-neutral-900">
              {b.count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ProgressScreen(): React.ReactElement {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  const childList = childrenQuery.data ?? [];
  const activeChild = useMemo(() => {
    if (selected) return childList.find((c) => c.id === selected) ?? null;
    return childList[0] ?? null;
  }, [childList, selected]);

  const assessmentsQuery = useQuery({
    queryKey: ["assessments", activeChild?.id ?? null],
    enabled: activeChild != null,
    queryFn: () =>
      activeChild
        ? listAssessments({ child_id: activeChild.id, limit: 20 })
        : Promise.resolve({ items: [], next_cursor: null, has_more: false }),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", activeChild?.id ?? null],
    enabled: activeChild != null,
    queryFn: () =>
      activeChild ? listAllChildAssignments(activeChild.id) : Promise.resolve([]),
  });

  const items = assessmentsQuery.data?.items ?? [];
  const completedAssignments = (assignmentsQuery.data ?? []).filter(
    (a) => a.completed_at != null,
  );
  const buckets = useMemo(
    () => bucketCompletedAssignments(completedAssignments),
    [completedAssignments],
  );

  const lastDate = formatDate(lastCompletedAt(items));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 48 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("progress.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("progress.subtitle")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="rounded-full bg-white px-3 py-2 border border-neutral-200"
          >
            <Text className="text-sm text-neutral-700">{t("common.back")}</Text>
          </Pressable>
        </View>

        {childList.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 text-xs font-medium uppercase text-neutral-500">
              {t("progress.selectChild")}
            </Text>
            <ChildSelector
              children={childList}
              selected={activeChild?.id ?? null}
              onSelect={setSelected}
            />
          </View>
        ) : null}

        {activeChild == null ? (
          <View className="mt-10 items-center gap-3">
            <Text className="text-base text-neutral-700">
              {t("home.noChildren")}
            </Text>
            <Button
              label={t("home.addChild")}
              fullWidth={false}
              onPress={() => router.push("/(parent)/children/new")}
            />
          </View>
        ) : (
          <>
            <Card variant="elevated" padding="lg" className="mt-6">
              <Text className="text-sm text-neutral-500">
                {t("progress.summary")}
              </Text>
              <View className="mt-3 flex-row items-center justify-between">
                <Badge
                  tone={riskTone(items[0]?.overall_risk ?? null)}
                  label={
                    items[0]?.overall_risk
                      ? t(`risk.${items[0].overall_risk}`)
                      : t("risk.pending")
                  }
                  size="md"
                />
                <Text className="text-sm text-neutral-600">
                  {t("progress.lastAssessment", { date: lastDate })}
                </Text>
              </View>
              <Text className="mt-3 text-sm text-neutral-700">
                {t("progress.exercisesCompleted")}
                {": "}
                <Text className="font-semibold">
                  {completedAssignments.length}
                </Text>
              </Text>
            </Card>

            <Card variant="outline" padding="lg" className="mt-4">
              <Text className="text-sm font-medium text-neutral-700">
                {t("progress.trend")}
              </Text>
              <View className="mt-4">
                <TrendChart buckets={buckets} />
              </View>
            </Card>

            <View className="mt-6 gap-3">
              {assessmentsQuery.isLoading ? (
                <ActivityIndicator size="large" color="#2563eb" />
              ) : assessmentsQuery.isError ? (
                <Text className="text-base text-risk-red">
                  {t("common.error")}
                </Text>
              ) : items.length === 0 ? (
                <Text className="text-base text-neutral-700">
                  {t("progress.empty")}
                </Text>
              ) : (
                items.map((a) => (
                  <Card key={a.id} variant="outline" padding="md">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-neutral-900">
                          {a.type}
                        </Text>
                        <Text className="text-xs text-neutral-500">
                          {formatDate(a.created_at)}
                        </Text>
                      </View>
                      <Badge
                        tone={riskTone(a.overall_risk)}
                        label={
                          a.overall_risk
                            ? t(`risk.${a.overall_risk}`)
                            : t("risk.pending")
                        }
                      />
                    </View>
                  </Card>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
