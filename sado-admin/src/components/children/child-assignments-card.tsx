/**
 * Assignments card on the child detail page. Shows the most recent
 * exercise assignments and lets a privileged user create a new one or
 * mark an existing one complete / delete it.
 *
 * Visibility is decided by the caller — this component is only
 * mounted when the current user has the right role for this child.
 * The mutations themselves are server-side guarded.
 */
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignExerciseDialog } from "@/components/children/assign-exercise-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChildAssignments,
  useCompleteAssignment,
  useDeleteAssignment,
} from "@/hooks/queries/use-exercise-assignments";
import type { ExerciseAssignment } from "@/types";

interface ChildAssignmentsCardProps {
  childId: string;
  /** When false the action buttons are hidden (read-only view). */
  canManage: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function statusVariant(
  status: ExerciseAssignment["status"],
): "default" | "secondary" | "outline" | "risk-green" | "risk-yellow" | "risk-red" {
  switch (status) {
    case "completed":
      return "risk-green";
    case "in_progress":
      return "risk-yellow";
    case "pending":
      return "secondary";
    case "skipped":
    case "expired":
      return "risk-red";
    default:
      return "outline";
  }
}

export function ChildAssignmentsCard({
  childId,
  canManage,
}: ChildAssignmentsCardProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const query = useChildAssignments({ childId, limit: 20 });
  const completeMutation = useCompleteAssignment();
  const deleteMutation = useDeleteAssignment();

  const items: ReadonlyArray<ExerciseAssignment> = query.data?.items ?? [];

  const onComplete = (assignment: ExerciseAssignment) => {
    completeMutation.mutate({
      assignmentId: assignment.id,
      childId,
      score: null,
      notes: null,
    });
  };

  const onDelete = (assignment: ExerciseAssignment) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        t("children.detail.assignments.confirmDelete"),
      );
      if (!ok) return;
    }
    deleteMutation.mutate({ assignmentId: assignment.id, childId });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{t("children.detail.assignments.title")}</CardTitle>
            <CardDescription>
              {t("children.detail.assignments.desc")}
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("children.detail.assignments.assignTitle")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
              {t("children.detail.assignments.empty")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-brand-100 dark:divide-brand-800">
              {items.map((assignment) => {
                const isCompleting =
                  completeMutation.isPending &&
                  completeMutation.variables?.assignmentId === assignment.id;
                const isDeleting =
                  deleteMutation.isPending &&
                  deleteMutation.variables?.assignmentId === assignment.id;
                return (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium text-brand-900 dark:text-brand-100">
                        {assignment.exercise?.title ??
                          t("children.detail.assignments.unknownExercise")}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-brand-600 dark:text-brand-300">
                        <Badge variant={statusVariant(assignment.status)}>
                          {t(
                            `children.detail.assignments.statuses.${assignment.status}`,
                            { defaultValue: assignment.status },
                          )}
                        </Badge>
                        {assignment.due_date && (
                          <span>
                            {t("children.detail.assignments.due", {
                              date: formatDate(assignment.due_date),
                            })}
                          </span>
                        )}
                        {assignment.completed_at && (
                          <span>
                            {t("children.detail.assignments.completed", {
                              date: formatDate(assignment.completed_at),
                            })}
                          </span>
                        )}
                        {typeof assignment.score === "number" && (
                          <span>
                            {t("children.detail.assignments.score", {
                              value: assignment.score.toFixed(0),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        {assignment.status !== "completed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onComplete(assignment)}
                            disabled={
                              isCompleting || completeMutation.isPending
                            }
                            aria-label={t(
                              "children.detail.assignments.markComplete",
                            )}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {isCompleting
                              ? t("common.loading")
                              : t("children.detail.assignments.markComplete")}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(assignment)}
                          disabled={isDeleting || deleteMutation.isPending}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? t("common.loading") : t("common.delete")}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AssignExerciseDialog
        childId={childId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
