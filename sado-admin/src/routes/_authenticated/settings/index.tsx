import { createFileRoute } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { UserPublic } from "@/types";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsPage,
});

const profileSchema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email().or(z.literal("")).optional(),
  language: z.enum(["uz", "ru", "kk", "en"]),
});

type ProfileForm = z.infer<typeof profileSchema>;

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const queryClient = useQueryClient();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      language: (user?.language ?? "uz") as ProfileForm["language"],
    },
  });

  // Reset the form when the authoritative user changes (e.g. after refresh).
  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name,
        email: user.email ?? "",
        language: user.language,
      });
    }
  }, [user, form]);

  const mutation = useMutation<UserPublic, Error, ProfileForm>({
    mutationFn: (payload) =>
      apiClient.put<UserPublic>("/users/me", {
        full_name: payload.full_name,
        email: payload.email || null,
        language: payload.language,
      }),
    onSuccess: async (next) => {
      // Sync auth store + i18n with the new persisted state.
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      if (next.language && next.language !== i18n.language) {
        await i18n.changeLanguage(next.language);
      }
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });

  const themes = [
    { key: "light", icon: Sun },
    { key: "dark", icon: Moon },
    { key: "system", icon: Monitor },
  ] as const;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t("nav.settings")}
        description={t("settings.description")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
          <CardDescription>{t("settings.profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">{t("settings.fullName")}</Label>
              <Input id="full_name" {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <p className="text-xs text-risk-red">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-risk-red">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language">{t("settings.language")}</Label>
              <select
                id="language"
                {...form.register("language")}
                className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
              >
                <option value="uz">O'zbekcha</option>
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
            </div>

            {mutation.isError && (
              <p className="text-sm text-risk-red">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : t("errors.server")}
              </p>
            )}
            {mutation.isSuccess && (
              <p className="text-sm text-risk-green">{t("settings.saved")}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="radiogroup" aria-label={t("settings.appearance")}>
            {themes.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={theme === key}
                onClick={() => setTheme(key)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                  theme === key
                    ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-800 dark:text-brand-50"
                    : "border-brand-200 bg-white text-brand-700 hover:border-brand-400 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-200",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(`theme.${key}`)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
