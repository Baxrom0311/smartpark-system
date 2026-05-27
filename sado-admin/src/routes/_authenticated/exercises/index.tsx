import { createFileRoute, Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { useExercises } from "@/hooks/queries/use-exercises";
import type { Exercise } from "@/types";

export const Route = createFileRoute("/_authenticated/exercises/")({
  component: ExercisesPage,
});

const CATEGORIES = [
  "",
  "articulation",
  "vocabulary",
  "phonemic_awareness",
  "fluency",
  "listening",
  "grammar",
  "breathing",
] as const;

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

function ExercisesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");

  const query = useExercises({
    search: search || undefined,
    category: category || undefined,
  });
  const rows = useMemo<Exercise[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const columnHelper = createColumnHelper<Exercise>();
  const columns = useMemo<ColumnDef<Exercise, unknown>[]>(
    () => [
      columnHelper.accessor("title", {
        header: () => t("exercises.title"),
        cell: (info) => (
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: info.row.original.id }}
            className="font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-200"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("category", {
        header: () => t("exercises.category"),
        cell: (info) => (
          <Badge variant="secondary">
            {t(`exercises.categories.${info.getValue()}`, {
              defaultValue: info.getValue(),
            })}
          </Badge>
        ),
      }),
      columnHelper.accessor("age_group", {
        header: () => t("exercises.ageGroup"),
        cell: (info) =>
          t(`exercises.ageGroups.${info.getValue()}`, {
            defaultValue: info.getValue(),
          }),
      }),
      columnHelper.accessor("difficulty", {
        header: () => t("exercises.difficulty"),
        cell: (info) => (
          <Badge variant={difficultyVariant(info.getValue())}>
            {t(`exercises.difficulties.${info.getValue()}`, {
              defaultValue: info.getValue(),
            })}
          </Badge>
        ),
      }),
      columnHelper.accessor("language", {
        header: () => t("children.language"),
        cell: (info) => info.getValue().toUpperCase(),
      }),
      columnHelper.accessor("duration_minutes", {
        header: () => t("exercises.duration"),
        cell: (info) =>
          t("exercises.minutes", { count: info.getValue() }),
      }),
      columnHelper.accessor("is_active", {
        header: () => t("users.status"),
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="risk-green">{t("users.active")}</Badge>
          ) : (
            <Badge variant="outline">{t("users.inactive")}</Badge>
          ),
      }),
    ],
    [columnHelper, t],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.exercises")}
        description={t("exercises.description")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("exercises.searchPlaceholder")}
          className="w-full sm:max-w-sm"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label={t("exercises.category")}
          className="h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c || "all"} value={c}>
              {c
                ? t(`exercises.categories.${c}`, { defaultValue: c })
                : t("exercises.allCategories")}
            </option>
          ))}
        </select>
      </div>

      <DataTable<Exercise>
        columns={columns}
        data={rows}
        loading={query.isLoading}
        error={
          query.isError
            ? query.error instanceof Error
              ? query.error.message
              : t("errors.server")
            : null
        }
        emptyMessage={t("exercises.empty")}
        getRowId={(row) => row.id}
        hasMore={query.hasNextPage ?? false}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
