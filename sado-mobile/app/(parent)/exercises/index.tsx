/**
 * Exercises overview — shows two tabs:
 *
 *   1. "Assigned"   — exercise assignments for the selected child
 *   2. "Catalog"    — searchable catalogue of exercises the parent
 *                     can self-assign to one of their children
 *
 * The screen is the entry point for the parent's daily-exercise loop.
 * Assignments fetch from `/exercises/:child_id/assignments`; the
 * catalogue uses `/exercises` filtered by the child's language.
 */

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/api";
import { listAllChildren } from "@/services/children";
import {
  assignExercise,
  listAllChildAssignments,
  listExercises,
} from "@/services/exercises";
import type {
  AssignmentStatus,
  Child,
  Exercise,
  ExerciseAssignment,
} from "@/types";

type Tab = "assigned" | "catalog";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function statusTone(status: AssignmentStatus): "green" | "yellow" | "neutral" | "info" {
  if (status === "completed") return "green";
  if (status === "in_progress") return "info";
  if (status === "skipped") return "neutral";
  return "yellow";
}

function ChildSelector({
  children,
  selected,
  onSelect,
}: {
  children: Child[];
  selected: string | null;
  onSelect: (childId: string) => void;
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

function AssignmentCard({
  assignment,
}: {
  assignment: ExerciseAssignment;
}): React.ReactElement {
  const { t } = useTranslation();
  const exercise = assignment.exercise;
  const title = exercise?.title ?? "—";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (exercise) {
          router.push({
            pathname: "/(parent)/exercises/[id]",
            params: { id: exercise.id, assignmentId: assignment.id },
          });
        }
      }}
    >
      <Card variant="outline" padding="md">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold text-neutral-900">
              {title}
            </Text>
            {exercise ? (
              <Text className="text-xs text-neutral-500">
                {t(`exercises.category.${exercise.category}`, {
                  defaultValue: exercise.category,
                })}
                {" · "}
                {t(`exercises.difficulty.${exercise.difficulty}`, {
                  defaultValue: exercise.difficulty,
                })}
              </Text>
            ) : null}
            <Text className="text-xs text-neutral-500">
              {t("exercises.due", { date: formatDate(assignment.due_date) })}
            </Text>
          </View>
          <Badge
            tone={statusTone(assignment.status)}
            label={t(`exercises.status.${assignment.status}`, {
              defaultValue: assignment.status,
            })}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function CatalogCard({
  exercise,
  childId,
  onAssigned,
}: {
  exercise: Exercise;
  childId: string | null;
  onAssigned: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const assign = useMutation({
    mutationFn: () => {
      if (!childId) throw new Error("no_child_selected");
      return assignExercise(childId, { exercise_id: exercise.id });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["assignments", childId],
      });
      onAssigned();
    },
  });

  const errorMessage = (() => {
    const err = assign.error;
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return null;
  })();

  return (
    <Card variant="outline" padding="md">
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push({
            pathname: "/(parent)/exercises/[id]",
            params: { id: exercise.id },
          });
        }}
      >
        <Text className="text-base font-semibold text-neutral-900">
          {exercise.title}
        </Text>
        {exercise.description ? (
          <Text className="mt-1 text-sm text-neutral-600" numberOfLines={2}>
            {exercise.description}
          </Text>
        ) : null}
        <View className="mt-2 flex-row flex-wrap gap-2">
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
        </View>
      </Pressable>

      <View className="mt-3">
        <Button
          label={
            assign.isSuccess ? t("exercises.assignSuccess") : t("exercises.assign")
          }
          variant={assign.isSuccess ? "secondary" : "primary"}
          size="sm"
          fullWidth
          loading={assign.isPending}
          disabled={childId == null}
          onPress={() => assign.mutate()}
        />
        {errorMessage != null ? (
          <Text className="mt-2 text-xs text-risk-red">{errorMessage}</Text>
        ) : null}
      </View>
    </Card>
  );
}

export default function ExercisesIndexScreen(): React.ReactElement {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("assigned");
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  const childList = childrenQuery.data ?? [];
  const activeChild = useMemo(() => {
    if (selectedChild) {
      return childList.find((c) => c.id === selectedChild) ?? null;
    }
    return childList[0] ?? null;
  }, [childList, selectedChild]);

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", activeChild?.id ?? null],
    enabled: activeChild != null,
    queryFn: () => {
      if (!activeChild) return Promise.resolve([] as ExerciseAssignment[]);
      return listAllChildAssignments(activeChild.id);
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["exercises", "catalog", activeChild?.language ?? null],
    queryFn: () =>
      listExercises({
        language: activeChild?.language ?? undefined,
        limit: 30,
      }),
  });

  const renderAssigned = (): React.ReactElement => {
    if (activeChild == null) {
      return (
        <View className="items-center gap-3 py-10">
          <Text className="text-base text-neutral-700">
            {t("exercises.noChildren")}
          </Text>
          <Button
            label={t("home.addChild")}
            fullWidth={false}
            onPress={() => router.push("/(parent)/children/new")}
          />
        </View>
      );
    }
    if (assignmentsQuery.isLoading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }
    if (assignmentsQuery.isError) {
      return (
        <View className="items-center gap-3 py-10">
          <Text className="text-base text-risk-red">{t("common.error")}</Text>
          <Button
            label={t("common.retry")}
            variant="outline"
            fullWidth={false}
            onPress={() => {
              void assignmentsQuery.refetch();
            }}
          />
        </View>
      );
    }

    const items = assignmentsQuery.data ?? [];
    if (items.length === 0) {
      return (
        <View className="items-center gap-2 py-10">
          <Text className="text-base text-neutral-700">
            {t("exercises.empty")}
          </Text>
          <Text className="text-xs text-neutral-500">
            {t("exercises.subtitle")}
          </Text>
        </View>
      );
    }

    return (
      <View className="gap-3">
        {items.map((a) => (
          <AssignmentCard key={a.id} assignment={a} />
        ))}
      </View>
    );
  };

  const renderCatalog = (): React.ReactElement => {
    if (catalogQuery.isLoading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }
    if (catalogQuery.isError) {
      return (
        <View className="items-center gap-3 py-10">
          <Text className="text-base text-risk-red">{t("common.error")}</Text>
          <Button
            label={t("common.retry")}
            variant="outline"
            fullWidth={false}
            onPress={() => {
              void catalogQuery.refetch();
            }}
          />
        </View>
      );
    }
    const items = catalogQuery.data?.items ?? [];
    if (items.length === 0) {
      return (
        <View className="items-center py-10">
          <Text className="text-base text-neutral-700">
            {t("exercises.emptyCatalog")}
          </Text>
        </View>
      );
    }
    return (
      <View className="gap-3">
        {items.map((exercise) => (
          <CatalogCard
            key={exercise.id}
            exercise={exercise}
            childId={activeChild?.id ?? null}
            onAssigned={() => {
              void assignmentsQuery.refetch();
            }}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 48 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("exercises.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("exercises.subtitle")}
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
              {t("exercises.selectChild")}
            </Text>
            <ChildSelector
              children={childList}
              selected={activeChild?.id ?? null}
              onSelect={setSelectedChild}
            />
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-2 rounded-full bg-neutral-200 p-1">
          {(["assigned", "catalog"] as const).map((id) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(id)}
                className={`flex-1 items-center justify-center rounded-full px-4 py-2 ${
                  active ? "bg-white shadow-sm" : ""
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    active ? "text-primary-700" : "text-neutral-600"
                  }`}
                >
                  {t(`exercises.tabs.${id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-6">
          {tab === "assigned" ? renderAssigned() : renderCatalog()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
