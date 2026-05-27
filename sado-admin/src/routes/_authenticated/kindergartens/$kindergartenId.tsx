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
import {
  useDeleteKindergarten,
  useKindergarten,
  useKindergartenStats,
  useUpdateKindergarten,
} from "@/hooks/queries/use-kindergartens";
import { useRegions } from "@/hooks/queries/use-regions";
import { ApiClientError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute(
  "/_authenticated/kindergartens/$kindergartenId",
)({
  component: KindergartenDetailPage,
  loader: ({ params }) => {
    if (!params.kindergartenId) throw notFound();
    return { kindergartenId: params.kindergartenId };
  },
});

const kgSchema = z.object({
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .optional()
    .or(z.literal("")),
  teacher_count: z
    .number({ invalid_type_error: "number" })
    .int()
    .min(0)
    .max(10_000),
  child_count: z
    .number({ invalid_type_error: "number" })
    .int()
    .min(0)
    .max(100_000),
  region_id: z.string().trim().max(36).optional().or(z.literal("")),
});

type KgForm = z.infer<typeof kgSchema>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function KindergartenDetailPage() {
  const { kindergartenId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const query = useKindergarten(kindergartenId);
  const statsQuery = useKindergartenStats(kindergartenId);
  const updateMutation = useUpdateKindergarten();
  const deleteMutation = useDeleteKindergarten();
  const regionsQuery = useRegions({ limit: 200 });
  const regions = useMemo(
    () => regionsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [regionsQuery.data],
  );

  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<KgForm>({
    resolver: zodResolver(kgSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      teacher_count: 0,
      child_count: 0,
      region_id: "",
    },
  });

  useEffect(() => {
    const k = query.data;
    if (k) {
      form.reset({
        name: k.name,
        address: k.address ?? "",
        phone: k.phone ?? "",
        teacher_count: k.teacher_count,
        child_count: k.child_count,
        region_id: k.region_id ?? "",
      });
    }
  }, [query.data, form]);

  const isAdmin = me?.role === "admin";

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof ApiClientError) {
      if (query.error.status === 404) return t("kindergartens.detail.notFound");
      if (query.error.status === 403) return t("errors.forbidden");
    }
    return query.error.message || t("errors.server");
  }, [query.error, t]);

  if (query.isLoading) return <KgDetailSkeleton />;

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/kindergartens"
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

  const kg = query.data;
  if (!kg) return null;

  const submit = form.handleSubmit((values) => {
    if (!isAdmin) return;
    updateMutation.mutate({
      kindergartenId: kg.id,
      name: values.name,
      address: values.address ? values.address : null,
      phone: values.phone ? values.phone : null,
      teacher_count: values.teacher_count,
      child_count: values.child_count,
      region_id: values.region_id ? values.region_id : null,
    });
  });

  const onDelete = () => {
    if (!isAdmin) return;
    deleteMutation.mutate(kg.id, {
      onSuccess: () => {
        void navigate({ to: "/kindergartens" });
      },
    });
  };

  const regionName = kg.region_id
    ? (regions.find((r) => r.id === kg.region_id)?.name ?? kg.region_id)
    : "—";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/kindergartens" })}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <Breadcrumbs />

      <PageHeader
        title={kg.name}
        description={t("kindergartens.detail.subtitle")}
        actions={
          isAdmin ? (
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
          <CardTitle>{t("kindergartens.detail.summary")}</CardTitle>
          <CardDescription>
            {t("kindergartens.detail.summaryDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <InfoRow label={t("kindergartens.address")} value={kg.address ?? "—"} />
            <InfoRow label={t("kindergartens.phone")} value={kg.phone ?? "—"} />
            <InfoRow
              label={t("kindergartens.teachers")}
              value={kg.teacher_count}
            />
            <InfoRow
              label={t("kindergartens.children")}
              value={kg.child_count}
            />
            <InfoRow label={t("kindergartens.region")} value={regionName} />
            <InfoRow
              label={t("users.createdAt")}
              value={formatDate(kg.created_at)}
            />
            <InfoRow
              label={t("users.detail.updatedAt")}
              value={formatDate(kg.updated_at)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("kindergartens.detail.statsTitle")}</CardTitle>
          <CardDescription>
            {t("kindergartens.detail.statsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : statsQuery.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock
                label={t("kindergartens.detail.totalChildren")}
                value={statsQuery.data.total_children}
              />
              <StatBlock
                label={t("kindergartens.detail.assessed")}
                value={statsQuery.data.assessed_children}
              />
              <StatBlock
                label={<Badge variant="risk-green">{t("risk.green")}</Badge>}
                value={statsQuery.data.risk_green}
              />
              <StatBlock
                label={<Badge variant="risk-yellow">{t("risk.yellow")}</Badge>}
                value={statsQuery.data.risk_yellow}
              />
              <StatBlock
                label={<Badge variant="risk-red">{t("risk.red")}</Badge>}
                value={statsQuery.data.risk_red}
              />
            </div>
          ) : (
            <p className="text-sm text-brand-500">{t("dashboard.noData")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("kindergartens.detail.editTitle")}</CardTitle>
          <CardDescription>
            {isAdmin
              ? t("kindergartens.detail.editDesc")
              : t("kindergartens.detail.editForbidden")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <fieldset
              disabled={!isAdmin || updateMutation.isPending}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">{t("kindergartens.name")}</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-risk-red">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="address">{t("kindergartens.address")}</Label>
                <Input id="address" {...form.register("address")} />
                {form.formState.errors.address && (
                  <p className="text-xs text-risk-red">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">{t("kindergartens.phone")}</Label>
                  <Input id="phone" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-risk-red">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="region_id">{t("kindergartens.region")}</Label>
                  <select
                    id="region_id"
                    {...form.register("region_id")}
                    className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
                  >
                    <option value="">{t("kindergartens.detail.noRegion")}</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="teacher_count">
                    {t("kindergartens.teachers")}
                  </Label>
                  <Input
                    id="teacher_count"
                    type="number"
                    min={0}
                    max={10_000}
                    {...form.register("teacher_count", { valueAsNumber: true })}
                  />
                  {form.formState.errors.teacher_count && (
                    <p className="text-xs text-risk-red">
                      {form.formState.errors.teacher_count.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="child_count">
                    {t("kindergartens.children")}
                  </Label>
                  <Input
                    id="child_count"
                    type="number"
                    min={0}
                    max={100_000}
                    {...form.register("child_count", { valueAsNumber: true })}
                  />
                  {form.formState.errors.child_count && (
                    <p className="text-xs text-risk-red">
                      {form.formState.errors.child_count.message}
                    </p>
                  )}
                </div>
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
                      address: query.data.address ?? "",
                      phone: query.data.phone ?? "",
                      teacher_count: query.data.teacher_count,
                      child_count: query.data.child_count,
                      region_id: query.data.region_id ?? "",
                    });
                  }
                }}
                disabled={!isAdmin || !form.formState.isDirty}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !isAdmin ||
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
          title={t("kindergartens.detail.confirmDelete")}
          description={t("kindergartens.detail.confirmDeleteDesc", {
            name: kg.name,
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

interface StatBlockProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-900/40">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-brand-900 dark:text-brand-100">
        {value}
      </div>
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

function KgDetailSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
