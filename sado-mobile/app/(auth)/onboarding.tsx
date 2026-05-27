/**
 * Onboarding screen shown the first time a user opens the app or after
 * logging out. Lets the user pick a language (uz/ru) before continuing
 * to the login/register flow. Persists the language choice via the
 * i18n config helpers.
 */

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import {
  setLanguage,
  type SupportedLanguage,
} from "@/i18n/config";

interface LanguageOption {
  code: SupportedLanguage;
  labelKey: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "uz", labelKey: "onboarding.languageUz" },
  { code: "ru", labelKey: "onboarding.languageRu" },
];

export default function OnboardingScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? "uz",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await setLanguage(selected);
      router.replace("/(auth)/login");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 py-10">
        <View className="gap-3">
          <Text className="text-3xl font-bold text-primary-700">
            {t("onboarding.welcomeTitle")}
          </Text>
          <Text className="text-base text-neutral-600">
            {t("onboarding.welcomeSubtitle")}
          </Text>
        </View>

        <View className="mt-10 gap-4">
          <Text className="text-lg font-semibold text-neutral-900">
            {t("onboarding.languageTitle")}
          </Text>
          <View className="gap-3">
            {LANGUAGES.map((lang) => {
              const isActive = lang.code === selected;
              return (
                <Pressable
                  key={lang.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={t(lang.labelKey)}
                  onPress={() => setSelected(lang.code)}
                  className={`flex-row items-center justify-between rounded-2xl border px-5 py-4 ${
                    isActive
                      ? "border-primary-600 bg-primary-50"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      isActive ? "text-primary-700" : "text-neutral-800"
                    }`}
                  >
                    {t(lang.labelKey)}
                  </Text>
                  <View
                    className={`h-5 w-5 rounded-full border-2 ${
                      isActive
                        ? "border-primary-600 bg-primary-600"
                        : "border-neutral-300"
                    }`}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-auto">
          <Button
            label={t("onboarding.getStarted")}
            onPress={() => {
              void handleContinue();
            }}
            loading={isSaving}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
