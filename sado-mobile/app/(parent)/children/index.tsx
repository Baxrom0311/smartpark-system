/**
 * Children list — read-only summary of every child registered to the
 * authenticated parent. Renders empty/loading/error states explicitly
 * so the user always knows what's happening.
 *
 * Tapping the floating "Add child" button routes to `/children/new`.
 */

import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listAllChildren } from "@/services/children";
import type { Child } from "@/types";

function ChildRow({ child }: { child: Child }): React.ReactElement {
  const { t } = useTranslation();
  const genderLabel =
    child.gender === "male"
      ? t("child.genderMale")
      : child.gender === "female"
        ? t("child.genderFemale")
        : t("child.genderUnknown");

  return (
    <Card variant="outline" padding="md">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
            {child.name}
          </Text>
          <Text className="text-xs text-neutral-500">
            {t("child.ageYears", { count: child.age_years })}
          </Text>
        </View>
        <Badge tone="info" label={genderLabel} />
      </View>
    </Card>
  );
}

export default function ChildrenIndexScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <View className="px-6 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("child.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("child.subtitle")}
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
              void refetch();
            }}
          />
        </View>
      ) : (data?.length ?? 0) === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-base text-neutral-700">{t("child.empty")}</Text>
          <Button
            label={t("home.addChild")}
            onPress={() => router.push("/(parent)/children/new")}
            fullWidth={false}
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 96 }}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChildRow child={item} />}
          refreshing={isFetching}
          onRefresh={() => {
            void refetch();
          }}
        />
      )}

      <View className="absolute bottom-6 left-6 right-6">
        <Button
          label={t("home.addChild")}
          onPress={() => router.push("/(parent)/children/new")}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}
