/**
 * Teacher group detail — shows the kindergarten metadata, the risk
 * distribution served by `/kindergartens/:id/stats`, and the list of
 * children belonging to the group.
 *
 * Each child row exposes a "Start screening" action that creates a
 * screening assessment for that child and routes the teacher into
 * the standard assessment flow (which is shared with the parent
 * experience).
 */

import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listChildren } from "@/services/children";
import {
  getKindergarten,
  getKindergartenStats,
} from "@/services/kindergartens";
import { createAssessment } from "@/services/assessments";
import { useAssessmentStore } from "@/stores/assessment-store";
import type { Child, KindergartenStats } from "@/types";

interface RiskBarProps {
  stats: KindergartenStats;
}

function RiskDistribution({ stats }: RiskBarProps): React.ReactElement {
  const { t } = useTranslation();
  const total = stats.risk_green + stats.risk_yellow + stats.risk_red || 1;
  const greenPct = (stats.risk_green / total) * 100;
  const yellowPct = (stats.risk_yellow / total) * 100;
  const redPct = (stats.risk_red / total) * 100;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-500">
        {t("teacher.riskDistribution")}
      </Text>
      <View
        className="h-3 flex-row overflow-hidden rounded-full bg-neutral-200"
        accessibilityRole="progressbar"
        accessibilityLabel={t("teacher.riskDistribution")}
      >
        <View
          style={{ width: `${greenPct}%` }}
          className="h-full bg-risk-green"
        />
        <View
          style={{ width: `${yellowPct}%` }}
          className="h-full bg-risk-yellow"
        />
        <View
          style={{ width: `${redPct}%` }}
          className="h-full bg-risk-red"
        />
      </View>
      <View className="flex-row gap-2">
        <Badge
          tone="green"
          label={t("teacher.riskGreenCount", { count: stats.risk_green })}
        />
        <Badge
          tone="yellow"
          label={t("teacher.riskYellowCount", { count: stats.risk_yellow })}
        />
        <Badge
          tone="red"
          label={t("teacher.riskRedCount", { count: stats.risk_red })}
        />
      </View>
      <Text className="text-xs text-neutral-500">
        {t("teacher.assessedCount", {
          assessed: stats.assessed_children,
          total: stats.total_children,
        })}
      </Text>
    </View>
  );
}

interface ChildRowProps {
  child: Child;
  onScreen: () => void;
  isScreening: boolean;
}

function ChildRow({
  child,
  onScreen,
  isScreening,
}: ChildRowProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Card variant="outline" padding="md">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text
            className="text-base font-semibold text-neutral-900"
            numberOfLines={1}
          >
            {child.name}
          </Text>
          <Text className="text-xs text-neutral-500">
            {t("child.ageYears", { count: child.age_years })}
          </Text>
        </View>
        <Button
          label={t("teacher.screen")}
          variant="primary"
          size="sm"
          fullWidth={false}
          loading={isScreening}
          onPress={onScreen}
        />
      </View>
    </Card>
  );
}

export default function TeacherGroupScreen(): React.ReactElement {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = typeof params.id === "string" ? params.id : "";
  const queryClient = useQueryClient();
  const startSession = useAssessmentStore((state) => state.startSession);

  const groupQuery = useQuery({
    queryKey: ["teacher", "kindergarten", groupId],
    queryFn: () => getKindergarten(groupId),
    enabled: groupId.length > 0,
  });

  const statsQuery = useQuery({
    queryKey: ["teacher", "kindergarten", groupId, "stats"],
    queryFn: () => getKindergartenStats(groupId),
    enabled: groupId.length > 0,
  });

  const childrenQuery = useQuery({
    queryKey: ["teacher", "kindergarten", groupId, "children"],
    queryFn: async (): Promise<Child[]> => {
      const items: Child[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 25; i++) {
        const page = await listChildren({
          kindergarten_id: groupId,
          cursor,
          limit: 50,
        });
        items.push(...page.items);
        if (!page.has_more || !page.next_cursor) break;
        cursor = page.next_cursor;
      }
      return items;
    },
    enabled: groupId.length > 0,
  });

  const screenMutation = useMutation({
    mutationFn: async (child: Child) => {
      const assessment = await createAssessment({
        child_id: child.id,
        type: "screening",
      });
      return { child, assessment };
    },
    onSuccess: ({ assessment, child }) => {
      startSession(assessment, child.id);
      void queryClient.invalidateQueries({
        queryKey: ["teacher", "kindergarten", groupId],
      });
      router.push("/(parent)/assessment/game");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : t("common.error");
      Alert.alert(t("common.error"), message);
    },
  });

  const isLoading =
    groupQuery.isLoading || statsQuery.isLoading || childrenQuery.isLoading;
  const isError =
    groupQuery.isError || statsQuery.isError || childrenQuery.isError;

  const children = useMemo(
    () => childrenQuery.data ?? [],
    [childrenQuery.data],
  );

  if (groupId.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-neutral-700">
            {t("teacher.notFound")}
          </Text>
          <View className="mt-3">
            <Button
              label={t("common.back")}
              variant="outline"
              fullWidth={false}
              onPress={() => router.back()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <View className="px-6 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text
              className="text-2xl font-bold text-neutral-900"
              numberOfLines={1}
            >
              {groupQuery.data?.name ?? t("teacher.title")}
            </Text>
            {groupQuery.data?.address != null ? (
              <Text className="text-xs text-neutral-500" numberOfLines={1}>
                {groupQuery.data.address}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="rounded-full border border-neutral-200 bg-white px-3 py-2"
          >
            <Text className="text-sm text-neutral-700">
              {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-base text-risk-red">{t("common.error")}</Text>
          <Button
            label={t("common.retry")}
            variant="outline"
            fullWidth={false}
            onPress={() => {
              void groupQuery.refetch();
              void statsQuery.refetch();
              void childrenQuery.refetch();
            }}
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 12,
          }}
          data={children}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="gap-3 pb-2">
              {statsQuery.data ? (
                <Card variant="elevated" padding="lg">
                  <RiskDistribution stats={statsQuery.data} />
                </Card>
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-neutral-900">
                  {t("teacher.childrenInGroup", { count: children.length })}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Card variant="outline" padding="lg">
              <Text className="text-sm text-neutral-700">
                {t("teacher.noChildrenInGroup")}
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <ChildRow
              child={item}
              isScreening={
                screenMutation.isPending &&
                screenMutation.variables?.id === item.id
              }
              onScreen={() => screenMutation.mutate(item)}
            />
          )}
          refreshing={
            (groupQuery.isFetching && !groupQuery.isLoading) ||
            (statsQuery.isFetching && !statsQuery.isLoading) ||
            (childrenQuery.isFetching && !childrenQuery.isLoading)
          }
          onRefresh={() => {
            void groupQuery.refetch();
            void statsQuery.refetch();
            void childrenQuery.refetch();
          }}
        />
      )}
    </SafeAreaView>
  );
}
