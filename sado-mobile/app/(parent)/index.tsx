/**
 * Parent home screen — entry point after a successful login. Shows a
 * greeting, primary CTAs (start assessment, daily exercise) and a
 * placeholder for the children list which will be populated by the
 * children query in a later milestone.
 *
 * This screen intentionally avoids any direct API calls — it consumes
 * the auth store for the user and delegates server data to query
 * hooks that will be wired up in subsequent builds.
 */

import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/auth-store";

export default function ParentHomeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const greetingName = user?.full_name ?? "";

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
              />
            </View>
          </Card>

          <Card variant="outline" padding="lg">
            <Text className="text-lg font-semibold text-neutral-900">
              {t("home.todaysExercise")}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600">
              {t("common.loading")}
            </Text>
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
