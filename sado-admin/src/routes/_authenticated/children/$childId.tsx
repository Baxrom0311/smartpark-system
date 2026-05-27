import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { InfoRow } from "@/components/shared/info-row";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ChildAssignmentsCard } from "@/components/children/child-assignments-card";
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
import { RiskBadge } from "@/components/shared/risk-badge";
import { useAssessments } from "@/hooks/queries/use-assessments";
import {
  useChild,
  useDeleteChild,
  useUpdateChild,
} from "@/hooks/queries/use-children";
import { useKindergartens } from "@/hooks/queries/use-kindergartens";
import { ApiClientError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Assessment, UserLanguage } from "@/types";

export const Route = createFileRoute("/_authenticated/children/$childId")({
  component: ChildDetailPage,
  loader: ({ params }) => {
    if (!params.childId) throw notFound();
    return { childId: params.childId };
  },
});

const GENDERS = ["male", "female", "unknown"] as const;
const LANGUAGES = ["uz", "ru", "kk", "en"] as const;

const childSchema = z.object({
  name: z.string().trim().min(1).max(120),
  birth_date: z
    .string()
    .min(1)
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "YYYY-MM-DD"),
  gender: z.enum(GENDERS),
  language: z.enum(LANGUAGES),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  kindergarten_id: z.string().trim().max(36).optional().or(z.literal("")),
});

type ChildForm = z.infer<typeof childSchema>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ChildDetailPage() {
  const { childId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const query = useChild(childId);
  const updateMutation = useUpdateChild();
  const deleteMutation = useDeleteChild();
  const kgQuery = useKindergartens({ limit: 50 });
  const kgs = useMemo(
    () => kgQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [kgQuery.data],
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<ChildForm>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      name: "",
      birth_date: "",
      gender: "unknown",
      language: "uz",
      notes: "",
      kindergarten_id: "",
    },
  });

  useEffect(() => {
    const c = query.data;
    if (c) {
      form.reset({
        name: c.name,
        birth_date: c.birth_date,
        gender: c.gender,
        language: c.language,
        notes: c.notes ?? "",
        kindergarten_id: c.kindergarten_id ?? "",
      });
    }
  }, [query.data, form]);

  const canEdit = useMemo(() => {
    if (!me || !query.data) return false;
    if (me.role === "admin") return true;
    if (me.role === "parent") return query.data.parent_id === me.id;
    return false;
  }, [me, query.data]);

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof ApiClientError) {
      if (query.error.status === 404) return t("children.detail.notFound");
      if (query.error.status === 403) return t("errors.forbidden");
    }
    return query.error.message || t("errors.server");
  }, [query.error, t]);

  if (query.isLoading) return <ChildDetailSkeleton />;

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/children"
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

  const child = query.data;
  if (!child) return null;

  const isPrivileged = me?.role === "therapist" || me?.role === "admin";

  const submit = form.handleSubmit((values) => {
    if (!canEdit) return;
    updateMutation.mutate({
      childId: child.id,
      name: values.name,
      birth_date: values.birth_date,
      gender: values.gender,
      language: values.language as UserLanguage,
      notes: values.notes ? values.notes : null,
      kindergarten_id: values.kindergarten_id ? values.kindergarten_id : null,
    });
  });

  const onDelete = () => {
    if (!canEdit) return;
    deleteMutation.mutate(child.id, {
      onSuccess: () => {
        void navigate({ to: "/children" });
      },
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/children" })}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <Breadcrumbs />

      <PageHeader
        title={child.name}
        description={t("children.detail.subtitle")}
        actions={
          canEdit ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("children.detail.summary")}</CardTitle>
          <CardDescription>{t("children.detail.summaryDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <InfoRow
              label={t("children.age")}
              value={t("children.ageYears", { count: child.age_years })}
            />
            <InfoRow
              label={t("children.birthDate")}
              value={formatDate(child.birth_date)}
            />
            <InfoRow
              label={t("children.gender")}
              value={
                <Badge variant="secondary">
                  {t(`children.genders.${child.gender}`)}
                </Badge>
              }
            />
            <InfoRow
              label={t("children.language")}
              value={child.language.toUpperCase()}
            />
            <InfoRow
              label={t("children.kindergarten")}
              value={
                child.kindergarten_id
                  ? (kgs.find((k) => k.id === child.kindergarten_id)?.name ??
                    child.kindergarten_id)
                  : "—"
              }
            />
            <InfoRow
              label={t("children.detail.parentId")}
              value={child.parent_id}
            />
            <InfoRow
              label={t("users.createdAt")}
              value={formatDate(child.created_at)}
            />
            <InfoRow
              label={t("users.detail.updatedAt")}
              value={formatDate(child.updated_at)}
            />
            {child.notes && (
              <InfoRow
                label={t("children.detail.notes")}
                value={
                  <span className="whitespace-pre-wrap">{child.notes}</span>
                }
              />
            )}
          </dl>
        </CardContent>
      </Card>

      {isPrivileged && (
        <ChildAssessmentsCard childId={child.id} />
      )}

      <ChildAssignmentsCard childId={child.id} canManage={canEdit} />

      <Card>
        <CardHeader>
          <CardTitle>{t("children.detail.editTitle")}</CardTitle>
          <CardDescription>
            {canEdit
              ? t("children.detail.editDesc")
              : t("children.detail.editForbidden")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <fieldset
              disabled={!canEdit || updateMutation.isPending}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">{t("children.name")}</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-risk-red">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="birth_date">{t("children.birthDate")}</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    {...form.register("birth_date")}
                  />
                  {form.formState.errors.birth_date && (
                    <p className="text-xs text-risk-red">
                      {form.formState.errors.birth_date.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gender">{t("children.gender")}</Label>
                  <select
                    id="gender"
                    {...form.register("gender")}
                    className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {t(`children.genders.${g}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="language">{t("children.language")}</Label>
                  <select
                    id="language"
                    {...form.register("language")}
                    className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kindergarten_id">
                    {t("children.kindergarten")}
                  </Label>
                  <select
                    id="kindergarten_id"
                    {...form.register("kindergarten_id")}
                    className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                  >
                    <option value="">
                      {t("children.detail.noKindergarten")}
                    </option>
                    {kgs.map((kg) => (
                      <option key={kg.id} value={kg.id}>
                        {kg.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">{t("children.detail.notes")}</Label>
                <textarea
                  id="notes"
                  rows={3}
                  {...form.register("notes")}
                  className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                />
                {form.formState.errors.notes && (
                  <p className="text-xs text-risk-red">
                    {form.formState.errors.notes.message}
                  </p>
                )}
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
              <p className="text-sm text-risk-green">{t("settings.saved")}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (query.data) {
                    form.reset({
                      name: query.data.name,
                      birth_date: query.data.birth_date,
                      gender: query.data.gender,
                      language: query.data.language,
                      notes: query.data.notes ?? "",
                      kindergarten_id: query.data.kindergarten_id ?? "",
                    });
                  }
                }}
                disabled={!canEdit || !form.formState.isDirty}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !canEdit ||
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

      {confirmDelete && (
        <DeleteConfirm
          title={t("children.detail.confirmDelete")}
          description={t("children.detail.confirmDeleteDesc", {
            name: child.name,
          })}
          confirmLabel={t("common.delete")}
          pending={deleteMutation.isPending}
          error={
            deleteMutation.isError
              ? deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : t("errors.server")
              : null
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

interface DeleteConfirmProps {
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirm({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: DeleteConfirmProps) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-risk-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? t("common.loading") : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChildDetailSkeleton() {
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

interface ChildAssessmentsCardProps {
  childId: string;
}

/**
 * Therapist-only card showing recent assessments for this child with a
 * link to the detailed analysis page (`/analysis/{assessmentId}`).
 *
 * The endpoint is server-side guarded — this UI just hides the link
 * for non-therapists/admins so they don't see a 403 on click.
 */
function ChildAssessmentsCard({ childId }: ChildAssessmentsCardProps) {
  const { t } = useTranslation();
  const query = useAssessments({ childId, limit: 5 });
  const items: ReadonlyArray<Assessment> = query.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("children.detail.assessments.title")}</CardTitle>
        <CardDescription>
          {t("children.detail.assessments.desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="text-sm text-risk-red">
            {query.error instanceof Error
              ? query.error.message
              : t("errors.server")}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-brand-500">
            {t("children.detail.assessments.empty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-100 dark:divide-brand-800">
            {items.map((assessment) => (
              <li
                key={assessment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {assessment.risk_level ? (
                    <RiskBadge level={assessment.risk_level} />
                  ) : (
                    <Badge variant="outline">{assessment.status}</Badge>
                  )}
                  <span className="text-sm text-brand-700 dark:text-brand-200">
                    {formatDate(assessment.completed_at ?? assessment.created_at)}
                  </span>
                </div>
                <Link
                  to="/analysis/$assessmentId"
                  params={{ assessmentId: assessment.id }}
                  className="text-sm font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-200"
                >
                  {t("children.detail.assessments.viewAnalysis")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
