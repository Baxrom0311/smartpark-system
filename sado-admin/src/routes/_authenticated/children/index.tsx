import { createFileRoute } from "@tanstack/react-router";
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
import { useChildren } from "@/hooks/queries/use-children";
import type { Child } from "@/types";

export const Route = createFileRoute("/_authenticated/children/")({
  component: ChildrenPage,
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function genderBadge(gender: string): "default" | "secondary" | "outline" {
  switch (gender) {
    case "male":
      return "default";
    case "female":
      return "secondary";
    default:
      return "outline";
  }
}

function ChildrenPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const query = useChildren({ search: search || undefined });
  const rows = useMemo<Child[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const columnHelper = createColumnHelper<Child>();
  const columns = useMemo<ColumnDef<Child, unknown>[]>(
    () => [
      columnHelper.accessor("name", {
        header: () => t("children.name"),
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("birth_date", {
        header: () => t("children.birthDate"),
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor("age_years", {
        header: () => t("children.age"),
        cell: (info) =>
          t("children.ageYears", { count: info.getValue() }),
      }),
      columnHelper.accessor("gender", {
        header: () => t("children.gender"),
        cell: (info) => (
          <Badge variant={genderBadge(info.getValue())}>
            {t(`children.genders.${info.getValue()}`)}
          </Badge>
        ),
      }),
      columnHelper.accessor("language", {
        header: () => t("children.language"),
        cell: (info) => info.getValue().toUpperCase(),
      }),
      columnHelper.accessor("kindergarten_id", {
        header: () => t("children.kindergarten"),
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("created_at", {
        header: () => t("users.createdAt"),
        cell: (info) => formatDate(info.getValue()),
      }),
    ],
    [columnHelper, t],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.children")}
        description={t("children.description")}
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t("children.searchPlaceholder")}
        className="w-full sm:max-w-sm"
      />

      <DataTable<Child>
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
        emptyMessage={t("children.empty")}
        getRowId={(row) => row.id}
        hasMore={query.hasNextPage ?? false}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
