/**
 * Registration screen for parent and teacher accounts.
 *
 * The backend rejects admin/therapist self-registration, so we only
 * present those two role options here. After a successful registration
 * we navigate to the login screen — the user enters their credentials
 * one more time so the access token is bound to a fresh login session.
 */

import { useState } from "react";
import { Keyboard, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";
import type { UserLanguage, UserRole } from "@/types";
import { getCurrentLanguage } from "@/i18n/config";

type Mode = "email" | "phone";

const PHONE_RE = /^\+?[0-9]{8,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: ReadonlyArray<{ role: UserRole; labelKey: string }> = [
  { role: "parent", labelKey: "onboarding.roleParent" },
  { role: "teacher", labelKey: "onboarding.roleTeacher" },
];

export default function RegisterScreen(): React.ReactElement {
  const { t } = useTranslation();
  const register = useAuthStore((state) => state.register);
  const storeStatus = useAuthStore((state) => state.status);

  const [mode, setMode] = useState<Mode>("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("parent");

  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);

  const isSubmitting = storeStatus === "loading";

  const validate = (): boolean => {
    let ok = true;
    if (identifier.trim().length === 0) {
      setIdentifierError(t("auth.identifierRequired"));
      ok = false;
    } else if (mode === "email" && !EMAIL_RE.test(identifier.trim())) {
      setIdentifierError(t("auth.invalidEmail"));
      ok = false;
    } else if (mode === "phone" && !PHONE_RE.test(identifier.trim())) {
      setIdentifierError(t("auth.invalidPhone"));
      ok = false;
    } else {
      setIdentifierError(null);
    }
    if (password.length < 8) {
      setPasswordError(t("auth.passwordMin"));
      ok = false;
    } else {
      setPasswordError(null);
    }
    if (fullName.trim().length === 0) {
      setNameError(t("common.error"));
      ok = false;
    } else {
      setNameError(null);
    }
    return ok;
  };

  const onSubmit = async (): Promise<void> => {
    Keyboard.dismiss();
    setSubmitError(null);
    setSubmitInfo(null);
    if (!validate()) return;
    try {
      const trimmed = identifier.trim();
      const language = getCurrentLanguage() as UserLanguage;
      await register({
        ...(mode === "email" ? { email: trimmed } : { phone: trimmed }),
        password,
        full_name: fullName.trim(),
        role,
        language,
      });
      setSubmitInfo(t("auth.registrationSuccess"));
      // Brief delay so the user sees the success message before
      // we route back to login.
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 800);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError(t("common.error"));
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-10">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-primary-700">
              {t("auth.registerTitle")}
            </Text>
            <Text className="text-base text-neutral-600">
              {t("auth.registerSubtitle")}
            </Text>
          </View>

          <View className="mt-8 flex-row gap-2">
            <Button
              label={t("auth.usePhone")}
              variant={mode === "phone" ? "primary" : "outline"}
              size="sm"
              fullWidth={false}
              onPress={() => setMode("phone")}
            />
            <Button
              label={t("auth.useEmail")}
              variant={mode === "email" ? "primary" : "outline"}
              size="sm"
              fullWidth={false}
              onPress={() => setMode("email")}
            />
          </View>

          <View className="mt-6 gap-4">
            <Input
              label={t("auth.fieldFullName")}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              error={nameError}
              textContentType="name"
            />
            <Input
              label={
                mode === "email"
                  ? t("auth.fieldEmail")
                  : t("auth.fieldPhone")
              }
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={mode === "email" ? "email-address" : "phone-pad"}
              placeholder={mode === "email" ? "you@example.com" : "+998901234567"}
              error={identifierError}
              textContentType={mode === "email" ? "emailAddress" : "telephoneNumber"}
            />
            <Input
              label={t("auth.fieldPassword")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              error={passwordError}
              textContentType="newPassword"
            />

            <View className="gap-2">
              <Text className="text-sm font-medium text-neutral-700">
                {t("onboarding.roleTitle")}
              </Text>
              <View className="flex-row gap-2">
                {ROLE_OPTIONS.map((option) => (
                  <Button
                    key={option.role}
                    label={t(option.labelKey)}
                    variant={role === option.role ? "primary" : "outline"}
                    size="sm"
                    fullWidth={false}
                    onPress={() => setRole(option.role)}
                  />
                ))}
              </View>
            </View>

            {submitError != null ? (
              <Text className="text-sm text-risk-red">{submitError}</Text>
            ) : null}
            {submitInfo != null ? (
              <Text className="text-sm text-risk-green">{submitInfo}</Text>
            ) : null}
          </View>

          <View className="mt-8 gap-4">
            <Button
              label={t("auth.submit")}
              size="lg"
              loading={isSubmitting}
              onPress={() => {
                void onSubmit();
              }}
            />
            <Link href="/(auth)/login" asChild>
              <Button
                label={t("auth.switchToLogin")}
                variant="ghost"
                size="md"
              />
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
