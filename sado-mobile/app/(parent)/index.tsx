/**
 * Parent home screen — entry point after a successful login.
 *
 * Shows a greeting, the registered children, and primary CTAs:
 *   - Add child  → /(parent)/children/new
 *   - Start assessment → /(parent)/assessment
 *
 * Children are loaded from the backend via TanStack Query so the list
 * stays in sync after the parent registers a new child.
 */

import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listAllChildren } from "@/services/children";
import { useAuthStore } from "@/stores/auth-store";
import type { Child } from "@/types";

function ChildPill({ child }: { child: Child }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={child.name}
      onPress={() => router.push("/(parent)/children")}
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"
    >
      <Text className="text-base font-semibold text-neutral-900">
        {child.name}
      </Text>
      <Text className="text-xs text-neutral-500">
        {t("child.ageYears", { count: child.age_years })}
      </Text>
    </Pressable>
  );
}

export default function ParentHomeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const childrenQuery = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  const greetingName = user?.full_name ?? "";
  const children = childrenQuery.data ?? [];
  const hasChildren = children.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        className="flex-1 px-6"
      >
        <View className="mt-2 flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("home.greeting", { name: greetingName })}
            </Text>
            <Badge tone="info" label={t("common.appName")} />
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

        <View className="mt-6 gap-4">
          <Card variant="elevated" padding="lg">
            <Text className="text-lg font-semibold text-neutral-900">
              {t("home.startAssessment")}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600">
              {t("common.tagline")}
            </Text>
            <View className="mt-4">
              <Button
                label={t("home.startAssessment")}
                size="md"
                accessibilityLabel={t("home.startAssessment")}
                onPress={() => router.push("/(parent)/assessment")}
              />
            </View>
          </Card>

          <Card variant="outline" padding="lg">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-neutral-900">
                {t("home.yourChildren")}
              </Text>
              <Button
                label={t("home.addChild")}
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => router.push("/(parent)/children/new")}
              />
            </View>

            <View className="mt-3">
              {childrenQuery.isLoading ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : childrenQuery.isError ? (
                <Text className="text-sm text-risk-red">
                  {t("common.error")}
                </Text>
              ) : !hasChildren ? (
                <View className="gap-2">
                  <Text className="text-sm text-neutral-700">
                    {t("home.noChildren")}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {t("home.noChildrenSubtitle")}
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {children.slice(0, 4).map((child) => (
                    <ChildPill key={child.id} child={child} />
                  ))}
                  {children.length > 4 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push("/(parent)/children")}
                      className="self-start rounded-full px-3 py-1"
                    >
                      <Text className="text-xs font-medium text-primary-700">
                        +{children.length - 4}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          </Card>

          <Card variant="outline" padding="lg">
            <Text className="text-lg font-semibold text-neutral-900">
              {t("home.progress")}
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Badge tone="green" label={t("risk.green")} />
              <Badge tone="yellow" label={t("risk.yellow")} />
              <Badge tone="red" label={t("risk.red")} />
            </View>
          </Card>
        </View>

        <View className="mt-8 items-center">
          <Text className="text-xs uppercase tracking-wider text-neutral-400">
            {t("common.appName")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
