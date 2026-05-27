/**
 * Login screen — accepts either email or phone + password and exchanges
 * them for a JWT pair via the auth store. Validation is light because
 * the backend is the source of truth; we only enforce non-empty fields
 * and a minimum password length client-side to keep round trips down.
 */

import { useMemo, useState } from "react";
import { Keyboard, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/services/api";
import { useAuthStore } from "@/stores/auth-store";

type Mode = "email" | "phone";

const PHONE_RE = /^\+?[0-9]{8,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen(): React.ReactElement {
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const storeStatus = useAuthStore((state) => state.status);

  const [mode, setMode] = useState<Mode>("phone");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmitting = storeStatus === "loading";

  const placeholder = useMemo(
    () => (mode === "email" ? "you@example.com" : "+998901234567"),
    [mode],
  );

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
    return ok;
  };

  const onSubmit = async (): Promise<void> => {
    Keyboard.dismiss();
    setSubmitError(null);
    if (!validate()) return;
    try {
      const trimmed = identifier.trim();
      await login({
        ...(mode === "email" ? { email: trimmed } : { phone: trimmed }),
        password,
      });
      router.replace("/(parent)");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSubmitError(t("auth.credentialsInvalid"));
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
              {t("auth.loginTitle")}
            </Text>
            <Text className="text-base text-neutral-600">
              {t("auth.loginSubtitle")}
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
              placeholder={placeholder}
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
              textContentType="password"
            />
            {submitError != null ? (
              <Text className="text-sm text-risk-red">{submitError}</Text>
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
            <Link href="/(auth)/register" asChild>
              <Button
                label={t("auth.switchToRegister")}
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
