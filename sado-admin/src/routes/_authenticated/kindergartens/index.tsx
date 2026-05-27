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
import { useKindergartens } from "@/hooks/queries/use-kindergartens";
import type { Kindergarten } from "@/types";

export const Route = createFileRoute("/_authenticated/kindergartens/")({
  component: KindergartensPage,
});

function KindergartensPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const query = useKindergartens({ search: search || undefined });
  const rows = useMemo<Kindergarten[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const columnHelper = createColumnHelper<Kindergarten>();
  const columns = useMemo<ColumnDef<Kindergarten, unknown>[]>(
    () => [
      columnHelper.accessor("name", {
        header: () => t("kindergartens.name"),
        cell: (info) => (
          <Link
            to="/kindergartens/$kindergartenId"
            params={{ kindergartenId: info.row.original.id }}
            className="font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-200"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("address", {
        header: () => t("kindergartens.address"),
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("phone", {
        header: () => t("kindergartens.phone"),
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("teacher_count", {
        header: () => t("kindergartens.teachers"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("child_count", {
        header: () => t("kindergartens.children"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("region_id", {
        header: () => t("kindergartens.region"),
        cell: (info) => info.getValue() ?? "—",
      }),
    ],
    [columnHelper, t],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.kindergartens")}
        description={t("kindergartens.description")}
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t("kindergartens.searchPlaceholder")}
        className="w-full sm:max-w-sm"
      />

      <DataTable<Kindergarten>
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
        emptyMessage={t("kindergartens.empty")}
        getRowId={(row) => row.id}
        hasMore={query.hasNextPage ?? false}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
