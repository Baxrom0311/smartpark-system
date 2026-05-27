import { createFileRoute, Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { useChildren } from "@/hooks/queries/use-children";
import { useChildrenLatestRisk } from "@/hooks/queries/use-assessments";
import { useKindergartens } from "@/hooks/queries/use-kindergartens";
import { useRegions } from "@/hooks/queries/use-regions";
import type { Child, Kindergarten, Region, RiskLevel } from "@/types";

export const Route = createFileRoute("/_authenticated/children/")({
  component: ChildrenPage,
});

const SELECT_CLASS =
  "h-10 rounded-lg border border-brand-200 bg-white px-3 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100";

type RiskFilter = "all" | RiskLevel | "none";
type AgeFilter = "all" | "2-4" | "5-7" | "8-12";

interface AgeRange {
  min: number;
  max: number;
}

const AGE_RANGES: Record<Exclude<AgeFilter, "all">, AgeRange> = {
  "2-4": { min: 2, max: 4 },
  "5-7": { min: 5, max: 7 },
  "8-12": { min: 8, max: 12 },
};

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
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [age, setAge] = useState<AgeFilter>("all");
  const [regionId, setRegionId] = useState<string>("all");

  const childrenQuery = useChildren({ search: search || undefined });
  const riskMap = useChildrenLatestRisk();
  const regionsQuery = useRegions({ limit: 100 });
  // Pull every kindergarten so we can resolve a child's region via its
  // kindergarten link. Tiny dataset (a few dozen at most), so a single
  // page is plenty.
  const kindergartensQuery = useKindergartens({ limit: 200 });

  const regions = useMemo<Region[]>(
    () => regionsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [regionsQuery.data],
  );
  const kindergartensById = useMemo<Map<string, Kindergarten>>(() => {
    const map = new Map<string, Kindergarten>();
    for (const page of kindergartensQuery.data?.pages ?? []) {
      for (const kg of page.items) map.set(kg.id, kg);
    }
    return map;
  }, [kindergartensQuery.data]);

  const allRows = useMemo<Child[]>(
    () => childrenQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [childrenQuery.data],
  );

  const rows = useMemo<Child[]>(() => {
    return allRows.filter((c) => {
      // Risk filter: derived from latest assessment map.
      if (risk !== "all") {
        const latest = riskMap.map.get(c.id)?.riskLevel ?? null;
        if (risk === "none" ? latest !== null : latest !== risk) return false;
      }
      // Age filter
      if (age !== "all") {
        const range = AGE_RANGES[age];
        if (c.age_years < range.min || c.age_years > range.max) return false;
      }
      // Region filter via kindergarten link.
      if (regionId !== "all") {
        if (regionId === "none") {
          if (c.kindergarten_id) return false;
        } else {
          const kg = c.kindergarten_id
            ? kindergartensById.get(c.kindergarten_id)
            : undefined;
          if (!kg || kg.region_id !== regionId) return false;
        }
      }
      return true;
    });
  }, [allRows, risk, age, regionId, riskMap.map, kindergartensById]);

  const columnHelper = createColumnHelper<Child>();
  const columns = useMemo<ColumnDef<Child, unknown>[]>(
    () => [
      columnHelper.accessor("name", {
        header: () => t("children.name"),
        cell: (info) => (
          <Link
            to="/children/$childId"
            params={{ childId: info.row.original.id }}
            className="font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-200"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.display({
        id: "risk_level",
        header: () => t("children.riskLevel"),
        cell: ({ row }) => {
          const latest = riskMap.map.get(row.original.id)?.riskLevel ?? null;
          if (!latest) {
            return (
              <span
                className="text-xs text-brand-500 dark:text-brand-400"
                aria-label={t("children.noRisk")}
              >
                —
              </span>
            );
          }
          return <RiskBadge level={latest} />;
        },
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
        cell: (info) => {
          const id = info.getValue();
          if (!id) return "—";
          const kg = kindergartensById.get(id);
          return kg ? kg.name : id;
        },
      }),
      columnHelper.accessor("created_at", {
        header: () => t("users.createdAt"),
        cell: (info) => formatDate(info.getValue()),
      }),
    ],
    [columnHelper, t, riskMap.map, kindergartensById],
  );

  const filtersActive = risk !== "all" || age !== "all" || regionId !== "all";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.children")}
        description={t("children.description")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("children.searchPlaceholder")}
          className="w-full sm:max-w-sm"
        />

        <select
          aria-label={t("children.filters.riskLabel")}
          className={SELECT_CLASS}
          value={risk}
          onChange={(e) => setRisk(e.target.value as RiskFilter)}
        >
          <option value="all">{t("children.filters.allRisks")}</option>
          <option value="green">{t("risk.green")}</option>
          <option value="yellow">{t("risk.yellow")}</option>
          <option value="red">{t("risk.red")}</option>
          <option value="none">{t("children.filters.noRisk")}</option>
        </select>

        <select
          aria-label={t("children.filters.ageLabel")}
          className={SELECT_CLASS}
          value={age}
          onChange={(e) => setAge(e.target.value as AgeFilter)}
        >
          <option value="all">{t("children.filters.allAges")}</option>
          <option value="2-4">{t("children.filters.age2to4")}</option>
          <option value="5-7">{t("children.filters.age5to7")}</option>
          <option value="8-12">{t("children.filters.age8to12")}</option>
        </select>

        <select
          aria-label={t("children.filters.regionLabel")}
          className={SELECT_CLASS}
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
        >
          <option value="all">{t("children.filters.allRegions")}</option>
          <option value="none">{t("children.filters.noRegion")}</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setRisk("all");
              setAge("all");
              setRegionId("all");
            }}
            className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-100"
          >
            {t("children.filters.clear")}
          </button>
        )}
      </div>

      <DataTable<Child>
        columns={columns}
        data={rows}
        loading={childrenQuery.isLoading}
        error={
          childrenQuery.isError
            ? childrenQuery.error instanceof Error
              ? childrenQuery.error.message
              : t("errors.server")
            : null
        }
        emptyMessage={
          filtersActive
            ? t("children.filters.empty")
            : t("children.empty")
        }
        getRowId={(row) => row.id}
        hasMore={childrenQuery.hasNextPage ?? false}
        loadingMore={childrenQuery.isFetchingNextPage}
        onLoadMore={() => void childrenQuery.fetchNextPage()}
      />
    </div>
  );
}
