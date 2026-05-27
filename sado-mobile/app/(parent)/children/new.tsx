/**
 * Add-child form — captures name, birth date, gender, language and
 * posts to `/api/v1/children`. The form is intentionally minimal so
 * parents can register a child in under 30 seconds.
 *
 * Birth date is collected as ISO `YYYY-MM-DD` text (no native date
 * picker dependency for now — keeps the bundle smaller and works on
 * Expo Go without extra setup).
 */

import { useState } from "react";
import { Keyboard, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/services/api";
import { createChild } from "@/services/children";
import { getCurrentLanguage } from "@/i18n/config";
import type { ChildGender, UserLanguage } from "@/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const GENDERS: ReadonlyArray<{ value: ChildGender; key: string }> = [
  { value: "male", key: "child.genderMale" },
  { value: "female", key: "child.genderFemale" },
  { value: "unknown", key: "child.genderUnknown" },
];

export default function NewChildScreen(): React.ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<ChildGender>("unknown");

  const [nameError, setNameError] = useState<string | null>(null);
  const [birthError, setBirthError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createChild,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      router.back();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError(t("common.error"));
      }
    },
  });

  const validate = (): boolean => {
    let ok = true;
    if (name.trim().length === 0) {
      setNameError(t("child.errorName"));
      ok = false;
    } else {
      setNameError(null);
    }
    if (!ISO_DATE_RE.test(birthDate.trim())) {
      setBirthError(t("child.errorBirth"));
      ok = false;
    } else {
      const parsed = new Date(`${birthDate.trim()}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        setBirthError(t("child.errorBirth"));
        ok = false;
      } else if (parsed.getTime() > Date.now()) {
        setBirthError(t("child.errorBirthFuture"));
        ok = false;
      } else {
        setBirthError(null);
      }
    }
    return ok;
  };

  const onSubmit = (): void => {
    Keyboard.dismiss();
    setSubmitError(null);
    if (!validate()) return;
    const language = getCurrentLanguage() as UserLanguage;
    createMutation.mutate({
      name: name.trim(),
      birth_date: birthDate.trim(),
      gender,
      language,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-8">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-primary-700">
              {t("child.addTitle")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("child.addSubtitle")}
            </Text>
          </View>

          <View className="mt-8 gap-4">
            <Input
              label={t("child.fieldName")}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={nameError}
            />
            <Input
              label={t("child.fieldBirthDate")}
              value={birthDate}
              onChangeText={setBirthDate}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholder="2020-04-15"
              error={birthError}
            />

            <View className="gap-2">
              <Text className="text-sm font-medium text-neutral-700">
                {t("child.fieldGender")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {GENDERS.map((option) => (
                  <Button
                    key={option.value}
                    label={t(option.key)}
                    variant={gender === option.value ? "primary" : "outline"}
                    size="sm"
                    fullWidth={false}
                    onPress={() => setGender(option.value)}
                  />
                ))}
              </View>
            </View>

            {submitError != null ? (
              <Text className="text-sm text-risk-red">{submitError}</Text>
            ) : null}
          </View>

          <View className="mt-auto gap-4 pt-8">
            <Button
              label={t("child.save")}
              size="lg"
              loading={createMutation.isPending}
              onPress={onSubmit}
            />
            <Button
              label={t("common.cancel")}
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
