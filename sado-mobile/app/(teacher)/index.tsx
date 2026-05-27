/**
 * Teacher home — lists every kindergarten visible to the teacher
 * (the API scopes the result to the teacher's region) plus a quick
 * summary card with totals and shortcuts into a per-group screening
 * view.
 *
 * Tapping a kindergarten routes to `/(teacher)/group/[id]` where the
 * teacher can see the children in that group and run a screening.
 */

import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { listAllKindergartens } from "@/services/kindergartens";
import { useAuthStore } from "@/stores/auth-store";
import type { Kindergarten } from "@/types";

interface GroupRowProps {
  group: Kindergarten;
  onPress: () => void;
}

function GroupRow({ group, onPress }: GroupRowProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={group.name}
      onPress={onPress}
    >
      <Card variant="outline" padding="md">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text
              className="text-base font-semibold text-neutral-900"
              numberOfLines={1}
            >
              {group.name}
            </Text>
            {group.address != null ? (
              <Text className="text-xs text-neutral-500" numberOfLines={1}>
                {group.address}
              </Text>
            ) : null}
            <View className="mt-1 flex-row gap-2">
              <Badge
                tone="info"
                label={t("teacher.childrenCount", {
                  count: group.child_count,
                })}
              />
              <Badge
                tone="neutral"
                label={t("teacher.teachersCount", {
                  count: group.teacher_count,
                })}
              />
            </View>
          </View>
          <Text className="text-base text-primary-700">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function TeacherHomeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const groupsQuery = useQuery({
    queryKey: ["teacher", "kindergartens"],
    queryFn: () => listAllKindergartens(),
  });

  const groups = groupsQuery.data ?? [];
  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => {
        acc.children += g.child_count;
        acc.teachers += g.teacher_count;
        return acc;
      },
      { children: 0, teachers: 0 },
    );
  }, [groups]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <View className="px-6 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("teacher.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("teacher.subtitle", { name: user?.full_name ?? "" })}
            </Text>
            <View className="mt-1">
              <OfflineIndicator hideWhenIdle />
            </View>
          </View>
          <Button
            label={t("common.logout")}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => {
              void logout();
            }}
          />
        </View>

        <View className="mt-4">
          <Card variant="elevated" padding="lg">
            <Text className="text-sm font-medium text-neutral-500">
              {t("teacher.summary")}
            </Text>
            <View className="mt-2 flex-row items-end justify-between">
              <View className="gap-1">
                <Text className="text-3xl font-bold text-primary-700">
                  {groups.length}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t("teacher.groupsLabel")}
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-3xl font-bold text-neutral-900">
                  {totals.children}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t("teacher.childrenLabel")}
                </Text>
              </View>
              <View className="gap-1">
                <Text className="text-3xl font-bold text-neutral-900">
                  {totals.teachers}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t("teacher.teachersLabel")}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </View>

      {groupsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : groupsQuery.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-base text-risk-red">{t("common.error")}</Text>
          <Button
            label={t("common.retry")}
            variant="outline"
            fullWidth={false}
            onPress={() => {
              void groupsQuery.refetch();
            }}
          />
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Text className="text-base text-neutral-700">
            {t("teacher.empty")}
          </Text>
          <Text className="text-xs text-neutral-500 text-center">
            {t("teacher.emptySubtitle")}
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 12,
          }}
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroupRow
              group={item}
              onPress={() =>
                router.push({
                  pathname: "/(teacher)/group/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          refreshing={groupsQuery.isFetching && !groupsQuery.isLoading}
          onRefresh={() => {
            void groupsQuery.refetch();
          }}
        />
      )}
    </SafeAreaView>
  );
}
