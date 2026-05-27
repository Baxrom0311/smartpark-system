/**
 * "Assign exercise" modal used on the child detail page. Lets a
 * privileged user (parent of the child, teacher in the same region,
 * therapist, or admin) pick an exercise from the catalogue and
 * optionally set a due date + notes before posting to
 * `/exercises/{child_id}/assign`.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useExercises } from "@/hooks/queries/use-exercises";
import { useAssignExercise } from "@/hooks/queries/use-exercise-assignments";
import { ApiClientError } from "@/lib/api-client";

interface AssignExerciseDialogProps {
  childId: string;
  open: boolean;
  onClose: () => void;
}

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100";

const schema = z
  .object({
    exercise_id: z.string().trim().min(1, "exercise.required"),
    due_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "exercise.dueDateInvalid")
      .optional()
      .or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { exercise_id: "", due_date: "", notes: "" };

export function AssignExerciseDialog({
  childId,
  open,
  onClose,
}: AssignExerciseDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  // Limited list — assigning happens from the active catalogue.
  const exercisesQuery = useExercises({ search, limit: 50 });
  const exerciseOptions = useMemo(
    () => exercisesQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [exercisesQuery.data],
  );

  const mutation = useAssignExercise();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset(DEFAULTS);
      mutation.reset();
      setSearch("");
    }
  }, [open, form, mutation]);

  const submitting = form.formState.isSubmitting || mutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        childId,
        exerciseId: values.exercise_id,
        dueDate:
          values.due_date && values.due_date.length > 0
            ? new Date(`${values.due_date}T00:00:00Z`).toISOString()
            : null,
        notes: values.notes && values.notes.length > 0 ? values.notes : null,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        form.setError("root", {
          type: "server",
          message: err.message || t("errors.server"),
        });
      } else if (err instanceof Error) {
        form.setError("root", { type: "server", message: err.message });
      }
    }
  });

  const errorKey = (key?: string): string =>
    key ? t(key, { defaultValue: t("errors.validation") }) : "";

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t("children.detail.assignments.assignTitle")}
      description={t("children.detail.assignments.assignDesc")}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="assign-exercise-form"
            disabled={submitting || exerciseOptions.length === 0}
          >
            {submitting
              ? t("common.loading")
              : t("children.detail.assignments.submit")}
          </Button>
        </>
      }
    >
      <form
        id="assign-exercise-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-search">
            {t("children.detail.assignments.searchLabel")}
          </Label>
          <Input
            id="assign-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("exercises.searchPlaceholder")}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-exercise">
            {t("children.detail.assignments.exerciseLabel")}
          </Label>
          <select
            id="assign-exercise"
            className={SELECT_CLASS}
            {...form.register("exercise_id")}
            aria-invalid={Boolean(form.formState.errors.exercise_id)}
          >
            <option value="">
              {exercisesQuery.isLoading
                ? t("common.loading")
                : t("children.detail.assignments.selectExercise")}
            </option>
            {exerciseOptions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} · {t(`exercises.categories.${ex.category}`, {
                  defaultValue: ex.category,
                })}
              </option>
            ))}
          </select>
          {exerciseOptions.length === 0 && !exercisesQuery.isLoading && (
            <p className="text-xs text-brand-500 dark:text-brand-400">
              {t("exercises.empty")}
            </p>
          )}
          {form.formState.errors.exercise_id && (
            <p className="text-xs text-risk-red">
              {errorKey(form.formState.errors.exercise_id.message)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-due-date">
            {t("children.detail.assignments.dueDate")}
          </Label>
          <Input
            id="assign-due-date"
            type="date"
            {...form.register("due_date")}
            aria-invalid={Boolean(form.formState.errors.due_date)}
          />
          {form.formState.errors.due_date && (
            <p className="text-xs text-risk-red">
              {errorKey(form.formState.errors.due_date.message)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-notes">
            {t("children.detail.assignments.notes")}
          </Label>
          <textarea
            id="assign-notes"
            rows={3}
            {...form.register("notes")}
            className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
          />
        </div>

        {form.formState.errors.root?.message && (
          <div
            role="alert"
            className="rounded-md border border-risk-red/30 bg-risk-red/10 px-3 py-2 text-sm text-risk-red"
          >
            {form.formState.errors.root.message}
          </div>
        )}
      </form>
    </Modal>
  );
}
