import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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
import { ApiClientError } from "@/lib/api-client";
import {
  loginEmailSchema as emailSchema,
  loginPhoneSchema as phoneSchema,
  type LoginFormValues,
} from "@/lib/validation/login";
import { useAuthStore } from "@/stores/auth-store";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: () => {
    const status = useAuthStore.getState().status;
    if (status === "authenticated") {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const schema = mode === "email" ? emailSchema : phoneSchema;
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "email"
        ? { mode: "email", email: "", password: "" }
        : { mode: "phone", phone: "", password: "" },
  });

  const switchMode = (next: "email" | "phone") => {
    if (next === mode) return;
    setMode(next);
    setSubmitError(null);
    form.reset(
      next === "email"
        ? { mode: "email", email: "", password: "" }
        : { mode: "phone", phone: "", password: "" },
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload =
        values.mode === "email"
          ? { email: values.email, password: values.password }
          : { phone: values.phone, password: values.password };
      await login(payload);
      void navigate({ to: search.redirect ?? "/" });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setSubmitError(t("auth.errorInvalid"));
      } else if (err instanceof Error) {
        setSubmitError(err.message || t("auth.errorGeneric"));
      } else {
        setSubmitError(t("auth.errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-12 dark:from-brand-950 dark:via-brand-900 dark:to-brand-950">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <CardTitle className="mt-4 text-2xl">{t("auth.welcome")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex rounded-lg border border-brand-200 p-1 dark:border-brand-800">
            <button
              type="button"
              onClick={() => switchMode("email")}
              className={
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (mode === "email"
                  ? "bg-brand-600 text-white"
                  : "text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-800")
              }
            >
              {t("auth.useEmail")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("phone")}
              className={
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (mode === "phone"
                  ? "bg-brand-600 text-white"
                  : "text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-800")
              }
            >
              {t("auth.usePhone")}
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {mode === "email" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  {...form.register("email")}
                  aria-invalid={Boolean(
                    (form.formState.errors as Record<string, unknown>)["email"],
                  )}
                />
                {(form.formState.errors as Record<string, { message?: string }>)[
                  "email"
                ]?.message && (
                  <p className="text-xs text-risk-red">
                    {
                      (
                        form.formState.errors as Record<
                          string,
                          { message?: string }
                        >
                      )["email"]?.message
                    }
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-phone">{t("auth.phone")}</Label>
                <Input
                  id="login-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+998901234567"
                  {...form.register("phone")}
                  aria-invalid={Boolean(
                    (form.formState.errors as Record<string, unknown>)["phone"],
                  )}
                />
                {(form.formState.errors as Record<string, { message?: string }>)[
                  "phone"
                ]?.message && (
                  <p className="text-xs text-risk-red">
                    {
                      (
                        form.formState.errors as Record<
                          string,
                          { message?: string }
                        >
                      )["phone"]?.message
                    }
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t("auth.password")}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
                aria-invalid={Boolean(form.formState.errors.password)}
              />
              {form.formState.errors.password?.message && (
                <p className="text-xs text-risk-red">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-risk-red/30 bg-risk-red/10 px-3 py-2 text-sm text-risk-red"
              >
                {submitError}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t("auth.loggingIn") : t("auth.loginButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
