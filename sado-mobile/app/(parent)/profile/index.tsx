/**
 * Profile screen.
 *
 * Lets the authenticated parent inspect their account, switch the
 * interface language, and log out. The user record itself comes from
 * the auth store so this screen never re-fetches the API.
 */

import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  type SupportedLanguage,
} from "@/i18n/config";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  parent: "profile.roleParent",
  teacher: "profile.roleTeacher",
  therapist: "profile.roleTherapist",
  admin: "profile.roleAdmin",
};

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  uz: "onboarding.languageUz",
  ru: "onboarding.languageRu",
};

export default function ProfileScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [activeLang, setActiveLang] = useState<SupportedLanguage>(
    (() => {
      const current = i18n.language;
      return (SUPPORTED_LANGUAGES as readonly string[]).includes(current)
        ? (current as SupportedLanguage)
        : "uz";
    })(),
  );
  const [busy, setBusy] = useState(false);

  const handleLanguage = async (lang: SupportedLanguage): Promise<void> => {
    if (lang === activeLang) return;
    setBusy(true);
    try {
      await setLanguage(lang);
      setActiveLang(lang);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setBusy(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } finally {
      setBusy(false);
    }
  };

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 48 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("profile.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("profile.subtitle")}
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

        <Card variant="elevated" padding="lg" className="mt-6">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-100">
              <Text className="text-xl font-bold text-primary-700">
                {user?.full_name?.[0]?.toUpperCase() ?? "·"}
              </Text>
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-lg font-semibold text-neutral-900">
                {user?.full_name ?? "—"}
              </Text>
              <Badge
                tone="info"
                label={t(ROLE_LABELS[user?.role ?? "parent"])}
              />
            </View>
          </View>

          <View className="mt-4 gap-2">
            <Row label={t("profile.email")} value={user?.email ?? "—"} />
            <Row label={t("profile.phone")} value={user?.phone ?? "—"} />
            <Row
              label={t("profile.role")}
              value={t(ROLE_LABELS[user?.role ?? "parent"])}
            />
          </View>
        </Card>

        <Card variant="outline" padding="lg" className="mt-4">
          <Text className="text-sm font-medium text-neutral-700">
            {t("profile.language")}
          </Text>
          <Text className="text-xs text-neutral-500">
            {t("profile.languageHint")}
          </Text>
          <View className="mt-3 flex-row gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = lang === activeLang;
              return (
                <Pressable
                  key={lang}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: busy }}
                  onPress={() => {
                    void handleLanguage(lang);
                  }}
                  disabled={busy}
                  className={`flex-1 items-center justify-center rounded-2xl border px-4 py-3 ${
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
                    {t(LANGUAGE_LABEL[lang])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View className="mt-6">
          <Button
            label={t("profile.logout")}
            variant="outline"
            loading={busy}
            onPress={() => {
              void handleLogout();
            }}
          />
        </View>

        <Text className="mt-8 text-center text-xs text-neutral-400">
          {t("profile.version", { version })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Text className="text-sm font-medium text-neutral-900" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
