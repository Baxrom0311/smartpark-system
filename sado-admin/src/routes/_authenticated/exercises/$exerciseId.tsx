/**
 * Exercise detail + edit page.
 *
 * Surfaces every field on the catalogue entry, lets a therapist or
 * admin edit metadata via React Hook Form + Zod, and uploads/replaces
 * audio + image example assets through the multipart endpoint at
 * `POST /exercises/{id}/assets`.
 *
 * Permission notes:
 *   - Read access is open to any authenticated role; the API hides
 *     inactive exercises from non-managers.
 *   - Edit/upload requires `therapist` or `admin`.
 *   - Delete requires `admin`.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFileRoute,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  FileAudio2,
  ImageIcon,
  Save,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
  useDeleteExercise,
  useDeleteExerciseAsset,
  useExercise,
  useUpdateExercise,
  useUploadExerciseAsset,
  type AssetType,
} from "@/hooks/queries/use-exercises";
import { ApiClientError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { Exercise, UserLanguage } from "@/types";

export const Route = createFileRoute("/_authenticated/exercises/$exerciseId")({
  component: ExerciseDetailPage,
  loader: ({ params }) => {
    if (!params.exerciseId) throw notFound();
    return { exerciseId: params.exerciseId };
  },
});

const CATEGORIES = [
  "articulation",
  "vocabulary",
  "phonemic_awareness",
  "fluency",
  "listening",
  "grammar",
  "breathing",
] as const;

const AGE_GROUPS = ["2-3", "4-5", "6-7", "8-10", "11-12"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const LANGUAGES = ["uz", "ru", "kk", "en"] as const satisfies readonly UserLanguage[];

const exerciseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  category: z.enum(CATEGORIES),
  age_group: z.enum(AGE_GROUPS),
  difficulty: z.enum(DIFFICULTIES),
  language: z.enum(LANGUAGES),
  duration_minutes: z
    .number({ invalid_type_error: "number" })
    .int()
    .min(1)
    .max(120),
  instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  target_phonemes: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("")),
  is_active: z.boolean(),
});

type ExerciseForm = z.infer<typeof exerciseSchema>;

const ALLOWED_AUDIO_MIME = [
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
];

const ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ExerciseDetailPage() {
  const { exerciseId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const query = useExercise(exerciseId);
  const updateMutation = useUpdateExercise();
  const deleteMutation = useDeleteExercise();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<ExerciseForm>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "articulation",
      age_group: "4-5",
      difficulty: "easy",
      language: "uz",
      duration_minutes: 5,
      instructions: "",
      target_phonemes: "",
      is_active: true,
    },
  });

  useEffect(() => {
    const e = query.data;
    if (!e) return;
    const safeCategory = (CATEGORIES as readonly string[]).includes(e.category)
      ? (e.category as (typeof CATEGORIES)[number])
      : "articulation";
    const safeAgeGroup = (AGE_GROUPS as readonly string[]).includes(e.age_group)
      ? (e.age_group as (typeof AGE_GROUPS)[number])
      : "4-5";
    const safeDifficulty = (DIFFICULTIES as readonly string[]).includes(
      e.difficulty,
    )
      ? (e.difficulty as (typeof DIFFICULTIES)[number])
      : "easy";
    form.reset({
      title: e.title,
      description: e.description ?? "",
      category: safeCategory,
      age_group: safeAgeGroup,
      difficulty: safeDifficulty,
      language: e.language,
      duration_minutes: e.duration_minutes,
      instructions: e.instructions ?? "",
      target_phonemes: e.target_phonemes ?? "",
      is_active: e.is_active,
    });
  }, [query.data, form]);

  const canManage = me?.role === "admin" || me?.role === "therapist";
  const canDelete = me?.role === "admin";

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof ApiClientError) {
      if (query.error.status === 404) return t("exercises.detail.notFound");
      if (query.error.status === 403) return t("errors.forbidden");
    }
    return query.error.message || t("errors.server");
  }, [query.error, t]);

  if (query.isLoading) return <ExerciseDetailSkeleton />;

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => void navigate({ to: "/exercises" })}
          className="inline-flex w-fit items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </button>
        <Card>
          <CardContent className="p-6 text-sm text-risk-red">
            {errorMessage}
          </CardContent>
        </Card>
      </div>
    );
  }

  const exercise = query.data;
  if (!exercise) return null;

  const submit = form.handleSubmit((values) => {
    if (!canManage) return;
    updateMutation.mutate({
      exerciseId: exercise.id,
      title: values.title,
      description: values.description ? values.description : null,
      category: values.category,
      age_group: values.age_group,
      difficulty: values.difficulty,
      language: values.language,
      duration_minutes: values.duration_minutes,
      instructions: values.instructions ? values.instructions : null,
      target_phonemes: values.target_phonemes ? values.target_phonemes : null,
      is_active: values.is_active,
    });
  });

  const onDelete = () => {
    if (!canDelete) return;
    deleteMutation.mutate(exercise.id, {
      onSuccess: () => {
        void navigate({ to: "/exercises" });
      },
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button
        type="button"
        onClick={() => void navigate({ to: "/exercises" })}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <Breadcrumbs />

      <PageHeader
        title={exercise.title}
        description={t("exercises.detail.subtitle")}
        actions={
          canDelete ? (
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
          <CardTitle>{t("exercises.detail.summary")}</CardTitle>
          <CardDescription>
            {t("exercises.detail.summaryDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <InfoRow
              label={t("exercises.category")}
              value={
                <Badge variant="secondary">
                  {t(`exercises.categories.${exercise.category}`, {
                    defaultValue: exercise.category,
                  })}
                </Badge>
              }
            />
            <InfoRow
              label={t("exercises.ageGroup")}
              value={t(`exercises.ageGroups.${exercise.age_group}`, {
                defaultValue: exercise.age_group,
              })}
            />
            <InfoRow
              label={t("exercises.difficulty")}
              value={
                <Badge variant={difficultyVariant(exercise.difficulty)}>
                  {t(`exercises.difficulties.${exercise.difficulty}`, {
                    defaultValue: exercise.difficulty,
                  })}
                </Badge>
              }
            />
            <InfoRow
              label={t("exercises.duration")}
              value={t("exercises.minutes", {
                count: exercise.duration_minutes,
              })}
            />
            <InfoRow
              label={t("exercises.detail.language")}
              value={exercise.language.toUpperCase()}
            />
            <InfoRow
              label={t("exercises.detail.targetPhonemes")}
              value={exercise.target_phonemes ?? "—"}
            />
            <InfoRow
              label={t("exercises.detail.isActive")}
              value={
                exercise.is_active ? (
                  <Badge variant="risk-green">
                    {t("exercises.detail.active")}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {t("exercises.detail.inactive")}
                  </Badge>
                )
              }
            />
            <InfoRow
              label={t("exercises.detail.createdAt")}
              value={formatDate(exercise.created_at)}
            />
            <InfoRow
              label={t("exercises.detail.updatedAt")}
              value={formatDate(exercise.updated_at)}
            />
          </dl>
        </CardContent>
      </Card>

      <AssetCard exercise={exercise} canManage={canManage} />

      <Card>
        <CardHeader>
          <CardTitle>{t("exercises.detail.editTitle")}</CardTitle>
          <CardDescription>
            {canManage
              ? t("exercises.detail.editDesc")
              : t("exercises.detail.editForbidden")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <fieldset
              disabled={!canManage || updateMutation.isPending}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">{t("exercises.title")}</Label>
                <Input id="title" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-xs text-risk-red">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="category">
                    {t("exercises.category")}
                  </Label>
                  <select
                    id="category"
                    {...form.register("category")}
                    className={SELECT_CLASS}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`exercises.categories.${c}`, { defaultValue: c })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="age_group">
                    {t("exercises.ageGroup")}
                  </Label>
                  <select
                    id="age_group"
                    {...form.register("age_group")}
                    className={SELECT_CLASS}
                  >
                    {AGE_GROUPS.map((a) => (
                      <option key={a} value={a}>
                        {t(`exercises.ageGroups.${a}`, { defaultValue: a })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="difficulty">
                    {t("exercises.difficulty")}
                  </Label>
                  <select
                    id="difficulty"
                    {...form.register("difficulty")}
                    className={SELECT_CLASS}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {t(`exercises.difficulties.${d}`, { defaultValue: d })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="language">
                    {t("exercises.detail.language")}
                  </Label>
                  <select
                    id="language"
                    {...form.register("language")}
                    className={SELECT_CLASS}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="duration_minutes">
                    {t("exercises.duration")}
                  </Label>
                  <Input
                    id="duration_minutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    {...form.register("duration_minutes", {
                      valueAsNumber: true,
                    })}
                  />
                  {form.formState.errors.duration_minutes && (
                    <p className="text-xs text-risk-red">
                      {form.formState.errors.duration_minutes.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="target_phonemes">
                    {t("exercises.detail.targetPhonemes")}
                  </Label>
                  <Input
                    id="target_phonemes"
                    placeholder="s, sh, r"
                    {...form.register("target_phonemes")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">
                  {t("exercises.detail.description")}
                </Label>
                <textarea
                  id="description"
                  rows={3}
                  {...form.register("description")}
                  className={TEXTAREA_CLASS}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="instructions">
                  {t("exercises.detail.instructions")}
                </Label>
                <textarea
                  id="instructions"
                  rows={4}
                  {...form.register("instructions")}
                  className={TEXTAREA_CLASS}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register("is_active")}
                  className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                />
                <span>{t("exercises.detail.active")}</span>
              </label>
            </fieldset>

            {updateMutation.isError && (
              <p className="text-sm text-risk-red">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : t("errors.server")}
              </p>
            )}
            {updateMutation.isSuccess && (
              <p className="inline-flex items-center gap-1 text-sm text-risk-green">
                <CheckCircle2 className="h-4 w-4" />
                {t("settings.saved")}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!query.data) return;
                  form.reset();
                }}
                disabled={!canManage || !form.formState.isDirty}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !canManage ||
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

      {confirmDelete && canDelete && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t("exercises.detail.confirmDelete")}</CardTitle>
              <CardDescription>
                {t("exercises.detail.confirmDeleteDesc", {
                  title: exercise.title,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const SELECT_CLASS =
  "h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100";

const TEXTAREA_CLASS =
  "min-h-20 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100";

function difficultyVariant(
  d: string,
): "risk-green" | "risk-yellow" | "risk-red" | "secondary" {
  switch (d) {
    case "easy":
      return "risk-green";
    case "medium":
      return "risk-yellow";
    case "hard":
      return "risk-red";
    default:
      return "secondary";
  }
}

interface AssetCardProps {
  exercise: Exercise;
  canManage: boolean;
}

function AssetCard({ exercise, canManage }: AssetCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("exercises.assets.title")}</CardTitle>
        <CardDescription>
          {t("exercises.assets.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AssetSlot
          exercise={exercise}
          assetType="audio"
          canManage={canManage}
          accept={ALLOWED_AUDIO_MIME}
          maxBytes={MAX_AUDIO_BYTES}
          icon={<FileAudio2 className="h-5 w-5" />}
        />
        <AssetSlot
          exercise={exercise}
          assetType="image"
          canManage={canManage}
          accept={ALLOWED_IMAGE_MIME}
          maxBytes={MAX_IMAGE_BYTES}
          icon={<ImageIcon className="h-5 w-5" />}
        />
      </CardContent>
    </Card>
  );
}

interface AssetSlotProps {
  exercise: Exercise;
  assetType: AssetType;
  canManage: boolean;
  accept: readonly string[];
  maxBytes: number;
  icon: React.ReactNode;
}

function AssetSlot({
  exercise,
  assetType,
  canManage,
  accept,
  maxBytes,
  icon,
}: AssetSlotProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const uploadMutation = useUploadExerciseAsset();
  const deleteMutation = useDeleteExerciseAsset();

  const currentPath =
    assetType === "audio"
      ? exercise.audio_example_path
      : exercise.image_path;

  const labelKey =
    assetType === "audio" ? "exercises.assets.audio" : "exercises.assets.image";
  const hintKey =
    assetType === "audio"
      ? "exercises.assets.audioHint"
      : "exercises.assets.imageHint";
  const noneKey =
    assetType === "audio"
      ? "exercises.assets.noAudio"
      : "exercises.assets.noImage";
  const uploadKey = currentPath
    ? assetType === "audio"
      ? "exercises.assets.replaceAudio"
      : "exercises.assets.replaceImage"
    : assetType === "audio"
      ? "exercises.assets.uploadAudio"
      : "exercises.assets.uploadImage";
  const removeKey =
    assetType === "audio"
      ? "exercises.assets.removeAudio"
      : "exercises.assets.removeImage";

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    setLocalError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset the input so the user can re-select the same file later.
    event.target.value = "";

    if (!accept.includes(file.type)) {
      setLocalError(t("exercises.assets.invalidType"));
      return;
    }
    if (file.size > maxBytes) {
      setLocalError(t("exercises.assets.tooLarge"));
      return;
    }
    uploadMutation.mutate({
      exerciseId: exercise.id,
      assetType,
      file,
    });
  };

  const handleRemove = (): void => {
    setLocalError(null);
    deleteMutation.mutate({
      exerciseId: exercise.id,
      assetType,
    });
  };

  const isPending = uploadMutation.isPending || deleteMutation.isPending;

  const networkError = useMemo(() => {
    if (uploadMutation.isError) {
      return uploadMutation.error instanceof Error
        ? uploadMutation.error.message
        : t("exercises.assets.uploadError");
    }
    if (deleteMutation.isError) {
      return deleteMutation.error instanceof Error
        ? deleteMutation.error.message
        : t("exercises.assets.deleteError");
    }
    return null;
  }, [
    deleteMutation.error,
    deleteMutation.isError,
    t,
    uploadMutation.error,
    uploadMutation.isError,
  ]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-100 bg-brand-50/40 p-4 dark:border-brand-800 dark:bg-brand-900/40">
      <div className="flex items-center gap-2">
        <span className="text-brand-600 dark:text-brand-300">{icon}</span>
        <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-100">
          {t(labelKey)}
        </h3>
      </div>
      <p className="text-xs text-brand-500 dark:text-brand-400">
        {t(hintKey)}
      </p>

      <div className="flex flex-col gap-2 text-xs text-brand-700 dark:text-brand-300">
        {currentPath ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-risk-green" />
            <div className="flex-1 break-all">
              <div className="font-medium">
                {t("exercises.assets.currentFile")}
              </div>
              <code className="text-[11px] text-brand-600 dark:text-brand-400">
                {currentPath}
              </code>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-brand-500">
            <XCircle className="h-4 w-4" />
            <span>{t(noneKey)}</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        onChange={handleFile}
        className="hidden"
        aria-label={t(uploadKey)}
        disabled={!canManage || isPending}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={!canManage || isPending}
        >
          <Upload className="h-4 w-4" />
          {uploadMutation.isPending
            ? t("exercises.assets.uploading")
            : t(uploadKey)}
        </Button>
        {currentPath && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRemove}
            disabled={!canManage || isPending}
          >
            <Trash2 className="h-4 w-4" />
            {t(removeKey)}
          </Button>
        )}
      </div>

      {(localError || networkError) && (
        <p className="text-xs text-risk-red">{localError ?? networkError}</p>
      )}
    </div>
  );
}

function ExerciseDetailSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-72" />
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
