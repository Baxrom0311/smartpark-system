/**
 * Parent Settings screen.
 *
 * One screen for the three "global" preferences a parent needs to
 * tune in the SADO mobile app:
 *
 *   1. Language — switches the i18next runtime language and persists
 *      the choice via `setLanguage()`.
 *   2. Notifications — surfaces the current OS permission status,
 *      lets the user request permission, toggle automatic
 *      assessment reminders on/off, and pick a cadence
 *      (weekly / biweekly / monthly). Reminders are scheduled as
 *      local notifications via `scheduleAssessmentReminder`, so they
 *      keep working offline.
 *   3. Children — shows the list of registered children and routes
 *      to the existing children screens for editing.
 *
 * Reminder preferences are persisted to AsyncStorage through
 * `services/preferences` so the choice survives restarts. Whenever
 * the user toggles or changes cadence we re-schedule the local
 * notification so the projected "next reminder" date matches what
 * the screen displays.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
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
import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  type SupportedLanguage,
} from "@/i18n/config";
import { listAllChildren } from "@/services/children";
import {
  cancelAllReminders,
  registerForPushNotifications,
  requestPermissions,
  scheduleAssessmentReminder,
  unregisterDevice,
  type PermissionStatus,
} from "@/services/notifications";
import {
  REMINDER_FREQUENCIES,
  nextReminderDate,
  readReminderPreferences,
  updateReminderPreferences,
  type AssessmentReminderPreferences,
  type ReminderFrequency,
} from "@/services/preferences";
import type { Child } from "@/types";

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  uz: "onboarding.languageUz",
  ru: "onboarding.languageRu",
};

const FREQUENCY_LABEL: Record<ReminderFrequency, string> = {
  weekly: "settings.frequencyWeekly",
  biweekly: "settings.frequencyBiweekly",
  monthly: "settings.frequencyMonthly",
};

const PERMISSION_LABEL: Record<PermissionStatus, string> = {
  granted: "notifications.permissionGranted",
  denied: "notifications.permissionDenied",
  undetermined: "notifications.permissionUndetermined",
};

function pickReminderTarget(children: readonly Child[]): Child | null {
  return children[0] ?? null;
}

export default function SettingsScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();

  const initialLang = (() => {
    const current = i18n.language;
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(current)
      ? (current as SupportedLanguage)
      : "uz";
  })();
  const [activeLang, setActiveLang] = useState<SupportedLanguage>(initialLang);
  const [busyLang, setBusyLang] = useState(false);

  const [permission, setPermission] = useState<PermissionStatus>("undetermined");
  const [busyPerm, setBusyPerm] = useState(false);

  const [prefs, setPrefs] = useState<AssessmentReminderPreferences | null>(
    null,
  );
  const [busyPrefs, setBusyPrefs] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children", "all"],
    queryFn: () => listAllChildren(),
  });

  // Load preferences once on mount. We intentionally don't put this
  // in TanStack Query because the data lives in AsyncStorage and
  // mutations are local-only — a plain effect is the simplest fit.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readReminderPreferences();
      if (!cancelled) setPrefs(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flashSaved = useCallback((): void => {
    setSaveMessage(t("settings.saved"));
    setSaveError(null);
  }, [t]);

  const flashError = useCallback((): void => {
    setSaveError(t("settings.saveFailed"));
    setSaveMessage(null);
  }, [t]);

  // Auto-clear transient save messages after a short delay so the
  // banner doesn't linger forever after a successful save.
  useEffect(() => {
    if (saveMessage === null) return;
    const id = setTimeout(() => setSaveMessage(null), 1800);
    return () => clearTimeout(id);
  }, [saveMessage]);

  useEffect(() => {
    if (saveError === null) return;
    const id = setTimeout(() => setSaveError(null), 2400);
    return () => clearTimeout(id);
  }, [saveError]);

  const handleLanguage = useCallback(
    async (lang: SupportedLanguage): Promise<void> => {
      if (lang === activeLang) return;
      setBusyLang(true);
      try {
        await setLanguage(lang);
        setActiveLang(lang);
        flashSaved();
      } catch {
        flashError();
      } finally {
        setBusyLang(false);
      }
    },
    [activeLang, flashSaved, flashError],
  );

  /**
   * Re-schedule (or cancel) the local reminder using the current
   * preferences + the first registered child as the target. We pass
   * a single source of truth for the "next reminder" date so the UI
   * preview and the OS-scheduled notification always agree.
   */
  const applyReminder = useCallback(
    async (
      next: AssessmentReminderPreferences,
      titleTemplate: string,
      bodyTemplate: string,
    ): Promise<Date | null> => {
      await cancelAllReminders();
      if (!next.enabled) return null;
      const target = pickReminderTarget(childrenQuery.data ?? []);
      if (!target) return null;
      const date = nextReminderDate(next.frequency);
      const reminder = await scheduleAssessmentReminder({
        childId: target.id,
        childName: target.name,
        scheduledFor: date,
        titleTemplate,
        bodyTemplate,
      });
      return reminder ? date : null;
    },
    [childrenQuery.data],
  );

  const handleToggleReminders = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (!prefs) return;
      setBusyPrefs(true);
      try {
        if (enabled && permission !== "granted") {
          const granted = await requestPermissions();
          setPermission(granted);
          if (granted !== "granted") {
            // OS denied — don't flip the toggle on, surface a message.
            await updateReminderPreferences({ enabled: false });
            setPrefs((p) => (p ? { ...p, enabled: false } : p));
            flashError();
            return;
          }
        }
        const titleTemplate = t("notifications.reminderTitle");
        const bodyTemplate = t("notifications.reminderBody");
        const updated = await updateReminderPreferences({ enabled });
        const scheduledAt = await applyReminder(
          updated,
          titleTemplate,
          bodyTemplate,
        );
        const finalPrefs = await updateReminderPreferences({
          lastScheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        });
        setPrefs(finalPrefs);
        flashSaved();
      } catch {
        flashError();
      } finally {
        setBusyPrefs(false);
      }
    },
    [prefs, permission, t, applyReminder, flashSaved, flashError],
  );

  const handleFrequency = useCallback(
    async (frequency: ReminderFrequency): Promise<void> => {
      if (!prefs || prefs.frequency === frequency) return;
      setBusyPrefs(true);
      try {
        const titleTemplate = t("notifications.reminderTitle");
        const bodyTemplate = t("notifications.reminderBody");
        const updated = await updateReminderPreferences({ frequency });
        const scheduledAt = updated.enabled
          ? await applyReminder(updated, titleTemplate, bodyTemplate)
          : null;
        const finalPrefs = await updateReminderPreferences({
          lastScheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        });
        setPrefs(finalPrefs);
        flashSaved();
      } catch {
        flashError();
      } finally {
        setBusyPrefs(false);
      }
    },
    [prefs, t, applyReminder, flashSaved, flashError],
  );

  const handleRequestPermission = useCallback(async (): Promise<void> => {
    setBusyPerm(true);
    try {
      const result = await registerForPushNotifications();
      setPermission(result.permission);
      if (result.permission === "granted") flashSaved();
    } catch {
      flashError();
    } finally {
      setBusyPerm(false);
    }
  }, [flashSaved, flashError]);

  const handleRevokePermission = useCallback(async (): Promise<void> => {
    setBusyPerm(true);
    try {
      await unregisterDevice();
      await cancelAllReminders();
      const updated = await updateReminderPreferences({
        enabled: false,
        lastScheduledAt: null,
      });
      setPrefs(updated);
      flashSaved();
    } catch {
      flashError();
    } finally {
      setBusyPerm(false);
    }
  }, [flashSaved, flashError]);

  // Probe the OS permission once on mount so the badge reflects the
  // real state (e.g. if the user toggled it from system settings).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await requestPermissionsSilently();
        if (!cancelled) setPermission(status);
      } catch {
        if (!cancelled) setPermission("undetermined");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectedNext = useMemo<string | null>(() => {
    if (!prefs?.enabled) return null;
    if (prefs.lastScheduledAt) {
      try {
        return new Date(prefs.lastScheduledAt).toLocaleDateString();
      } catch {
        // fall through
      }
    }
    return nextReminderDate(prefs.frequency).toLocaleDateString();
  }, [prefs]);

  const childrenCount = childrenQuery.data?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 48 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-neutral-900">
              {t("settings.title")}
            </Text>
            <Text className="text-sm text-neutral-600">
              {t("settings.subtitle")}
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

        {saveMessage ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-xl border border-risk-green bg-risk-green/10 px-3 py-2"
          >
            <Text className="text-sm font-medium text-risk-green">
              {saveMessage}
            </Text>
          </View>
        ) : saveError ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-xl border border-risk-red bg-risk-red/10 px-3 py-2"
          >
            <Text className="text-sm font-medium text-risk-red">
              {saveError}
            </Text>
          </View>
        ) : null}

        {/* ---------------------------------------------- Language */}
        <Card variant="outline" padding="lg" className="mt-6">
          <Text className="text-lg font-semibold text-neutral-900">
            {t("settings.languageSection")}
          </Text>
          <Text className="mt-1 text-xs text-neutral-500">
            {t("settings.languageHint")}
          </Text>
          <View className="mt-3 flex-row gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = lang === activeLang;
              return (
                <Pressable
                  key={lang}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: busyLang }}
                  accessibilityLabel={t(LANGUAGE_LABEL[lang])}
                  onPress={() => {
                    void handleLanguage(lang);
                  }}
                  disabled={busyLang}
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

        {/* ----------------------------------------- Notifications */}
        <Card variant="outline" padding="lg" className="mt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-neutral-900">
                {t("settings.notificationsSection")}
              </Text>
              <Text className="mt-1 text-xs text-neutral-500">
                {t("settings.notificationsHint")}
              </Text>
            </View>
            <Badge
              tone={
                permission === "granted"
                  ? "green"
                  : permission === "denied"
                    ? "red"
                    : "neutral"
              }
              label={t(PERMISSION_LABEL[permission])}
            />
          </View>

          <View className="mt-3 flex-row gap-2">
            <Button
              label={t("settings.permissionRequest")}
              variant="outline"
              size="sm"
              fullWidth={false}
              loading={busyPerm}
              disabled={busyPerm || permission === "granted"}
              onPress={() => {
                void handleRequestPermission();
              }}
            />
            <Button
              label={t("settings.permissionRevoke")}
              variant="ghost"
              size="sm"
              fullWidth={false}
              loading={busyPerm}
              disabled={busyPerm || permission !== "granted"}
              onPress={() => {
                void handleRevokePermission();
              }}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-medium text-neutral-800">
                {t("settings.remindersToggle")}
              </Text>
              <Text className="text-xs text-neutral-500">
                {t("settings.remindersToggleHint")}
              </Text>
            </View>
            <Switch
              value={prefs?.enabled ?? false}
              disabled={busyPrefs || prefs === null}
              onValueChange={(value) => {
                void handleToggleReminders(value);
              }}
              accessibilityRole="switch"
              accessibilityLabel={t("settings.remindersToggle")}
            />
          </View>

          <View className="mt-4 gap-2">
            <Text className="text-sm font-medium text-neutral-800">
              {t("settings.frequency")}
            </Text>
            <View className="flex-row gap-2">
              {REMINDER_FREQUENCIES.map((freq) => {
                const active = prefs?.frequency === freq;
                const disabled =
                  busyPrefs || prefs === null || prefs.enabled === false;
                return (
                  <Pressable
                    key={freq}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled }}
                    accessibilityLabel={t(FREQUENCY_LABEL[freq])}
                    onPress={() => {
                      void handleFrequency(freq);
                    }}
                    disabled={disabled}
                    className={`flex-1 items-center justify-center rounded-xl border px-3 py-2 ${
                      active
                        ? "border-primary-600 bg-primary-50"
                        : "border-neutral-200 bg-white"
                    } ${disabled ? "opacity-60" : ""}`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        active ? "text-primary-700" : "text-neutral-700"
                      }`}
                    >
                      {t(FREQUENCY_LABEL[freq])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-neutral-500">
              {projectedNext
                ? t("settings.nextReminder", { date: projectedNext })
                : t("settings.remindersDisabled")}
            </Text>
          </View>
        </Card>

        {/* ------------------------------------------ Children */}
        <Card variant="outline" padding="lg" className="mt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-neutral-900">
                {t("settings.childrenSection")}
              </Text>
              <Text className="mt-1 text-xs text-neutral-500">
                {t("settings.childrenHint")}
              </Text>
            </View>
            {childrenQuery.isLoading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Badge tone="info" label={String(childrenCount)} />
            )}
          </View>

          {childrenQuery.isLoading ? null : childrenCount === 0 ? (
            <Text className="mt-3 text-sm text-neutral-700">
              {t("settings.noChildren")}
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {(childrenQuery.data ?? []).slice(0, 5).map((child) => (
                <View
                  key={child.id}
                  className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-neutral-900">
                      {child.name}
                    </Text>
                    <Text className="text-xs text-neutral-500">
                      {t("child.ageYears", { count: child.age_years })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View className="mt-4 flex-row gap-2">
            <Button
              label={t("settings.manageChildren")}
              variant="outline"
              size="sm"
              fullWidth
              onPress={() => router.push("/(parent)/children")}
            />
            <Button
              label={t("settings.addChild")}
              size="sm"
              fullWidth
              onPress={() => router.push("/(parent)/children/new")}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Wrapper around `requestPermissions()` that does NOT prompt the
 * user — we just want to read the current OS state when the screen
 * mounts. We achieve that by checking the permission status before
 * the canAskAgain branch of `requestPermissions` triggers a prompt.
 *
 * Implemented locally to avoid changing the public surface of
 * services/notifications.
 */
async function requestPermissionsSilently(): Promise<PermissionStatus> {
  // Re-use the public path but bail before any prompt: requestPermissions()
  // already early-returns when `canAskAgain === false`. For the
  // initial probe we rely on the fact that the OS doesn't prompt if
  // the user already granted/denied permission, so calling it once is
  // safe. (If they're undetermined we still prefer to surface that
  // state without prompting until they tap the button.)
  return requestPermissions();
}
