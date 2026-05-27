/**
 * Exercise detail screen.
 *
 * Shows exercise instructions, target phonemes, and (optionally) an
 * audio example streamed from MinIO. If we arrived here from an
 * assignment, we display the assignment's status and offer a "mark
 * complete" CTA that calls `PUT /exercises/assignments/:id/complete`.
 *
 * Route params:
 *   - id            : exercise id (required)
 *   - assignmentId  : optional, when arriving from an assignment card
 */

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { GameCharacter } from "@/components/game/GameCharacter";
import { RewardAnimation } from "@/components/game/RewardAnimation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/api";
import {
  completeAssignment,
  getAssignment,
  getExercise,
} from "@/services/exercises";
import type { AssignmentStatus } from "@/types";

interface ExpoExtra {
  apiBaseUrl?: string;
  staticBaseUrl?: string;
}

function resolveStaticUrl(path: string | null): string | null {
  if (path == null) return null;
  if (/^https?:\/\//.test(path)) return path;
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const fromExtra = extra.staticBaseUrl;
  if (fromExtra) {
    return `${fromExtra.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }
  const apiBase = extra.apiBaseUrl ?? "http://localhost:8000/api/v1";
  // strip the `/api/v1` suffix to point at the static MinIO mount.
  const root = apiBase.replace(/\/?api\/v1\/?$/, "");
  return `${root.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function statusTone(status: AssignmentStatus): "green" | "yellow" | "neutral" | "info" {
  if (status === "completed") return "green";
  if (status === "in_progress") return "info";
  if (status === "skipped") return "neutral";
  return "yellow";
}

export default function ExerciseDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; assignmentId?: string }>();
  const exerciseId = typeof params.id === "string" ? params.id : null;
  const assignmentId =
    typeof params.assignmentId === "string" ? params.assignmentId : null;
  const queryClient = useQueryClient();
  const [showReward, setShowReward] = useState(false);

  const exerciseQuery = useQuery({
    queryKey: ["exercise", exerciseId],
    enabled: exerciseId != null,
    queryFn: () => {
      if (!exerciseId) throw new Error("missing_exercise_id");
      return getExercise(exerciseId);
    },
  });

  const assignmentQuery = useQuery({
    queryKey: ["assignment", assignmentId],
    enabled: assignmentId != null,
    queryFn: () => {
      if (!assignmentId) throw new Error("missing_assignment_id");
      return getAssignment(assignmentId);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => {
      if (!assignmentId) throw new Error("missing_assignment_id");
      return completeAssignment(assignmentId);
    },
    onSuccess: () => {
      setShowReward(true);
      void queryClient.invalidateQueries({
        queryKey: ["assignment", assignmentId],
      });
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  const exercise = exerciseQuery.data;
  const assignment = assignmentQuery.data;

  if (exerciseId == null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-base text-risk-red">{t("common.error")}</Text>
      </SafeAreaView>
    );
  }

  if (exerciseQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (exerciseQuery.isError || exercise == null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text className="text-base text-risk-red">{t("common.error")}</Text>
        <Button
          label={t("common.retry")}
          variant="outline"
          fullWidth={false}
          onPress={() => {
            void exerciseQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const audioUrl = resolveStaticUrl(exercise.audio_example_path);
  const isCompleted = assignment?.status === "completed";
  const completeError = (() => {
    const err = completeMutation.error;
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return null;
  })();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 48 }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="rounded-full border border-neutral-200 bg-white px-3 py-2"
          >
            <Text className="text-sm text-neutral-700">{t("common.back")}</Text>
          </Pressable>
          {assignment ? (
            <Badge
              tone={statusTone(assignment.status)}
              label={t(`exercises.status.${assignment.status}`, {
                defaultValue: assignment.status,
              })}
            />
          ) : null}
        </View>

        <View className="mt-4 items-center">
          <GameCharacter mood={isCompleted ? "celebrate" : "idle"} size={120} />
        </View>

        <Text className="mt-4 text-2xl font-bold text-neutral-900">
          {exercise.title}
        </Text>
        {exercise.description ? (
          <Text className="mt-1 text-sm text-neutral-600">
            {exercise.description}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-2">
          <Badge
            tone="info"
            label={t(`exercises.category.${exercise.category}`, {
              defaultValue: exercise.category,
            })}
          />
          <Badge
            tone="neutral"
            label={t(`exercises.difficulty.${exercise.difficulty}`, {
              defaultValue: exercise.difficulty,
            })}
          />
          <Badge
            tone="neutral"
            label={t("common.minutes", { count: exercise.duration_minutes })}
          />
          <Badge tone="neutral" label={exercise.language.toUpperCase()} />
        </View>

        <Card variant="outline" padding="lg" className="mt-6">
          <Text className="text-sm font-medium text-neutral-500">
            {t("exercises.instructions")}
          </Text>
          <Text className="mt-2 text-base text-neutral-800">
            {exercise.instructions ?? t("exercises.noInstructions")}
          </Text>
          {exercise.target_phonemes ? (
            <View className="mt-4">
              <Text className="text-sm font-medium text-neutral-500">
                {t("exercises.phonemes")}
              </Text>
              <Text className="mt-1 text-base font-semibold text-primary-700">
                {exercise.target_phonemes}
              </Text>
            </View>
          ) : null}
        </Card>

        <View className="mt-4">
          {audioUrl ? (
            <AudioPlayer
              uri={audioUrl}
              label={t("exercises.playExample")}
              durationSec={exercise.duration_minutes * 60}
            />
          ) : (
            <Card variant="default" padding="md">
              <Text className="text-sm text-neutral-500">
                {t("exercises.noExample")}
              </Text>
            </Card>
          )}
        </View>

        {assignment ? (
          <View className="mt-8">
            {isCompleted ? (
              <Card variant="elevated" padding="lg">
                <Text className="text-base font-semibold text-risk-green">
                  {t("exercises.completed")}
                </Text>
                {assignment.score != null ? (
                  <Text className="mt-1 text-sm text-neutral-600">
                    {t("exercises.score", { score: assignment.score })}
                  </Text>
                ) : null}
              </Card>
            ) : (
              <Button
                label={
                  completeMutation.isPending
                    ? t("exercises.completing")
                    : t("exercises.complete")
                }
                size="lg"
                loading={completeMutation.isPending}
                onPress={() => completeMutation.mutate()}
              />
            )}
            {completeError != null ? (
              <Text className="mt-2 text-sm text-risk-red">{completeError}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <RewardAnimation
        visible={showReward}
        label={t("exercises.completed")}
        onDone={() => setShowReward(false)}
      />
    </SafeAreaView>
  );
}
