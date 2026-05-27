import { createFileRoute, Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCreateDialog } from "@/components/users/user-create-dialog";
import { useUsers } from "@/hooks/queries/use-users";
import { useAuthStore } from "@/stores/auth-store";
import type { UserPublic, UserRole } from "@/types";

export const Route = createFileRoute("/_authenticated/users/")({
  component: UsersPage,
});

const ROLE_FILTERS: ReadonlyArray<{ value: "" | UserRole; key: string }> = [
  { value: "", key: "all" },
  { value: "parent", key: "parent" },
  { value: "teacher", key: "teacher" },
  { value: "therapist", key: "therapist" },
  { value: "admin", key: "admin" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function UsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [createOpen, setCreateOpen] = useState(false);
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";

  const query = useUsers({
    search: search || undefined,
    role: role || undefined,
  });

  const rows = useMemo<UserPublic[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const columnHelper = createColumnHelper<UserPublic>();
  const columns = useMemo<ColumnDef<UserPublic, unknown>[]>(
    () => [
      columnHelper.accessor("full_name", {
        header: () => t("users.name"),
        cell: (info) => (
          <Link
            to="/users/$userId"
            params={{ userId: info.row.original.id }}
            className="font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-200"
          >
            {info.getValue() || "—"}
          </Link>
        ),
      }),
      columnHelper.accessor("email", {
        header: () => t("auth.email"),
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("phone", {
        header: () => t("auth.phone"),
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("role", {
        header: () => t("users.role"),
        cell: (info) => (
          <Badge variant="secondary">{t(`users.roles.${info.getValue()}`)}</Badge>
        ),
      }),
      columnHelper.accessor("is_active", {
        header: () => t("users.status"),
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="risk-green">{t("users.active")}</Badge>
          ) : (
            <Badge variant="risk-red">{t("users.inactive")}</Badge>
          ),
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
        title={t("nav.users")}
        description={t("users.description")}
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("users.create.button")}
            </Button>
          ) : undefined
        }
      />

      {isAdmin && (
        <UserCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("users.searchPlaceholder")}
          className="w-full sm:max-w-sm"
        />
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-brand-200 bg-white p-1 dark:border-brand-800 dark:bg-brand-900"
          role="tablist"
        >
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.value || "all"}
              type="button"
              role="tab"
              aria-selected={role === filter.value}
              onClick={() => setRole(filter.value)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (role === filter.value
                  ? "bg-brand-600 text-white"
                  : "text-brand-600 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-800")
              }
            >
              {t(`users.filters.${filter.key}`)}
            </button>
          ))}
        </div>
      </div>

      <DataTable<UserPublic>
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
        emptyMessage={t("users.empty")}
        getRowId={(row) => row.id}
        hasMore={query.hasNextPage ?? false}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
