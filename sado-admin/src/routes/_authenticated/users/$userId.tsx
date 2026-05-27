import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Save, ShieldOff, ShieldCheck } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { InfoRow } from "@/components/shared/info-row";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api-client";
import {
  useToggleUserActive,
  useUpdateProfile,
  useUser,
} from "@/hooks/queries/use-user";
import { useAuthStore } from "@/stores/auth-store";
import type { UserLanguage } from "@/types";

export const Route = createFileRoute("/_authenticated/users/$userId")({
  component: UserDetailPage,
  loader: ({ params }) => {
    if (!params.userId) throw notFound();
    return { userId: params.userId };
  },
});

const LANGUAGES = ["uz", "ru", "kk", "en"] as const;

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .optional(),
  language: z.enum(LANGUAGES),
});

type ProfileForm = z.infer<typeof profileSchema>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function UserDetailPage() {
  const { userId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const query = useUser(userId);
  const updateMutation = useUpdateProfile();
  const toggleMutation = useToggleUserActive();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      email: "",
      language: "uz",
    },
  });

  // Hydrate the form once data arrives (or after a successful save).
  useEffect(() => {
    const u = query.data;
    if (u) {
      form.reset({
        full_name: u.full_name,
        email: u.email ?? "",
        language: u.language,
      });
    }
  }, [query.data, form]);

  const isSelf = useMemo(
    () => Boolean(me && query.data && me.id === query.data.id),
    [me, query.data],
  );

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof ApiClientError) {
      if (query.error.status === 404) return t("users.detail.notFound");
      if (query.error.status === 403) return t("errors.forbidden");
    }
    return query.error.message || t("errors.server");
  }, [query.error, t]);

  if (query.isLoading) {
    return <UserDetailSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/users"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        <Card>
          <CardContent className="p-6 text-sm text-risk-red">
            {errorMessage}
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = query.data;
  if (!user) return null;

  const submit = form.handleSubmit((values) => {
    if (!isSelf) return; // form is hidden when not editing self.
    updateMutation.mutate({
      full_name: values.full_name,
      email: values.email ? values.email : null,
      language: values.language as UserLanguage,
    });
  });

  const onToggleActive = () => {
    toggleMutation.mutate({ userId: user.id, isActive: !user.is_active });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => void navigate({ to: "/users" })}
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </button>
      </div>

      <Breadcrumbs />

      <PageHeader
        title={user.full_name || user.email || user.phone || user.id}
        description={t("users.detail.subtitle")}
        actions={
          <Button
            variant={user.is_active ? "destructive" : "default"}
            size="sm"
            onClick={onToggleActive}
            disabled={toggleMutation.isPending || isSelf}
            title={isSelf ? t("users.detail.cannotSelfDeactivate") : undefined}
          >
            {user.is_active ? (
              <>
                <ShieldOff className="h-4 w-4" />
                {t("users.detail.deactivate")}
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                {t("users.detail.activate")}
              </>
            )}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("users.detail.summary")}</CardTitle>
          <CardDescription>{t("users.detail.summaryDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <InfoRow label={t("users.role")} value={
              <Badge variant="secondary">
                {t(`users.roles.${user.role}`)}
              </Badge>
            } />
            <InfoRow
              label={t("users.status")}
              value={
                user.is_active ? (
                  <Badge variant="risk-green">{t("users.active")}</Badge>
                ) : (
                  <Badge variant="risk-red">{t("users.inactive")}</Badge>
                )
              }
            />
            <InfoRow label={t("auth.email")} value={user.email ?? "—"} />
            <InfoRow label={t("auth.phone")} value={user.phone ?? "—"} />
            <InfoRow
              label={t("settings.language")}
              value={user.language.toUpperCase()}
            />
            <InfoRow
              label={t("users.detail.verified")}
              value={
                user.is_verified
                  ? t("users.detail.yes")
                  : t("users.detail.no")
              }
            />
            <InfoRow
              label={t("users.createdAt")}
              value={formatDate(user.created_at)}
            />
            <InfoRow
              label={t("users.detail.updatedAt")}
              value={formatDate(user.updated_at)}
            />
          </dl>

          {toggleMutation.isError && (
            <p className="mt-3 text-sm text-risk-red">
              {toggleMutation.error instanceof Error
                ? toggleMutation.error.message
                : t("errors.server")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("users.detail.editTitle")}</CardTitle>
          <CardDescription>
            {isSelf
              ? t("users.detail.editSelfDesc")
              : t("users.detail.editOtherDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <fieldset
              disabled={!isSelf || updateMutation.isPending}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">{t("settings.fullName")}</Label>
                <Input
                  id="full_name"
                  autoComplete="name"
                  {...form.register("full_name")}
                />
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
                  className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                >
                  <option value="uz">O&apos;zbekcha</option>
                  <option value="ru">Русский</option>
                  <option value="kk">Қазақша</option>
                  <option value="en">English</option>
                </select>
              </div>
            </fieldset>

            {updateMutation.isError && (
              <p className="text-sm text-risk-red">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : t("errors.server")}
              </p>
            )}
            {updateMutation.isSuccess && (
              <p className="text-sm text-risk-green">
                {t("settings.saved")}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (query.data) {
                    form.reset({
                      full_name: query.data.full_name,
                      email: query.data.email ?? "",
                      language: query.data.language,
                    });
                  }
                }}
                disabled={!isSelf || !form.formState.isDirty}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !isSelf ||
                  updateMutation.isPending ||
                  !form.formState.isDirty
                }
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending
                  ? t("common.loading")
                  : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function UserDetailSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
