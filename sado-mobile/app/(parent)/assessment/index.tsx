/**
 * Assessment entry screen — pick a child and start a new assessment.
 *
 * If the parent has no children yet, we surface a clear empty state
 * with a CTA to register the first one. After the user picks a child
 * we POST `/assessments`, persist the active session in the
 * `useAssessmentStore`, and navigate to the recording game.
 */

import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/api";
import { createAssessment } from "@/services/assessments";
import { listAllChildren } from "@/services/children";
import { useAssessmentStore } from "@/stores/assessment-store";
import type { Child } from "@/types";

export default function AssessmentIndexScreen(): React.ReactElement {
  const { t } = useTranslation();
  const startSession = useAssessmentStore((state) => state.startSession);

  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  const startMutation = useMutation({
    mutationFn: createAssessment,
    onSuccess: (assessment, payload) => {
      startSession(assessment, payload.child_id);
      router.push("/(parent)/assessment/game");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError(t("common.error"));
    },
  });

  const handleStart = (): void => {
    if (selectedChild == null) return;
    setError(null);
    startMutation.mutate({ child_id: selectedChild, type: "screening" });
  };

  const renderChildPicker = (children: Child[]): React.ReactElement => (
    <View className="gap-3">
      <Text className="text-sm font-medium text-neutral-700">
        {t("assessment.pickChild")}
      </Text>
      <View className="gap-2">
        {children.map((child) => {
          const active = child.id === selectedChild;
          return (
            <Pressable
              key={child.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={child.name}
              onPress={() => setSelectedChild(child.id)}
              className={`flex-row items-center justify-between rounded-2xl border px-4 py-3 ${
                active
                  ? "border-primary-600 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-neutral-900">
                  {child.name}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t("child.ageYears", { count: child.age_years })}
                </Text>
              </View>
              <Badge tone={active ? "info" : "neutral"} label={child.language.toUpperCase()} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const isLoading = childrenQuery.isLoading;
  const hasError = childrenQuery.isError;
  const items = childrenQuery.data ?? [];
  const empty = !isLoading && !hasError && items.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-primary-700">
            {t("assessment.title")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="rounded-full bg-white px-3 py-2 border border-neutral-200"
          >
            <Text className="text-sm text-neutral-700">{t("common.back")}</Text>
          </Pressable>
        </View>

        <Card variant="outline" padding="lg" className="mt-6">
          <Text className="text-base font-semibold text-neutral-900">
            {t("assessment.introTitle")}
          </Text>
          <Text className="mt-2 text-sm text-neutral-600">
            {t("assessment.introBody")}
          </Text>
        </Card>

        <View className="mt-6">
          {isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : hasError ? (
            <View className="items-center gap-3 py-10">
              <Text className="text-base text-risk-red">
                {t("common.error")}
              </Text>
              <Button
                label={t("common.retry")}
                variant="outline"
                fullWidth={false}
                onPress={() => {
                  void childrenQuery.refetch();
                }}
              />
            </View>
          ) : empty ? (
            <View className="items-center gap-3 py-10">
              <Text className="text-base text-neutral-700">
                {t("assessment.noChildren")}
              </Text>
              <Button
                label={t("home.addChild")}
                fullWidth={false}
                onPress={() => router.push("/(parent)/children/new")}
              />
            </View>
          ) : (
            renderChildPicker(items)
          )}
        </View>

        {error != null ? (
          <Text className="mt-4 text-sm text-risk-red">{error}</Text>
        ) : null}

        <View className="mt-auto pt-6">
          <Button
            label={t("assessment.startGame")}
            size="lg"
            loading={startMutation.isPending}
            disabled={selectedChild == null || empty}
            onPress={handleStart}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
