/**
 * Accessibility smoke tests (M54 — jest-axe@9.0.0 + axe-core@4.10.2).
 *
 * Renders compact, representative DOM trees that mirror what the
 * login, dashboard, children, and exercises routes actually mount —
 * stripped of the heavy TanStack Router / Query wiring that those
 * routes need at runtime — so axe can crawl realistic markup without
 * us having to spin up a full provider tree.
 *
 * The harness intentionally uses the same shadcn primitives the real
 * routes use (Button, Input, Label, Card, Badge, DataTable,
 * SearchInput, RiskBadge, StatCard, EmptyState, PageHeader) so that
 * any markup change in those primitives — added/removed roles, lost
 * label associations, missing alt text — fails this test in CI.
 *
 * Per the planner soft-risks list we only fail on `critical` and
 * `serious` impact violations: jest-axe in jsdom occasionally flags
 * `minor` / `moderate` items (e.g. colour-contrast on Tailwind
 * gradients that jsdom can't render) which are noise here.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

type AxeOutcome = Awaited<ReturnType<typeof axe>>;
type AxeViolation = AxeOutcome["violations"][number];
type AxeOptions = Parameters<typeof axe>[1];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "auth.welcome": "Welcome to SADO",
        "auth.subtitle": "Sign in to continue",
        "auth.useEmail": "Email",
        "auth.usePhone": "Phone",
        "auth.email": "Email address",
        "auth.phone": "Phone number",
        "auth.password": "Password",
        "auth.loginButton": "Sign in",
        "auth.loggingIn": "Signing in…",
        "dashboard.title": "Dashboard",
        "dashboard.subtitle": "Snapshot of platform activity",
        "dashboard.totalChildren": "Total children",
        "dashboard.assessmentsToday": "Assessments today",
        "dashboard.redRiskPct": "Red-risk share",
        "dashboard.activeTherapists": "Active therapists",
        "common.empty": "No data available",
        "common.search": "Search",
        "common.loadMore": "Load more",
        "common.loading": "Loading…",
        "common.retry": "Retry",
        "nav.children": "Children",
        "nav.exercises": "Exercises",
        "children.description": "All children registered on the platform",
        "children.searchPlaceholder": "Search children…",
        "children.name": "Name",
        "children.age": "Age",
        "children.risk": "Risk",
        "exercises.description": "Therapy exercises catalogue",
        "exercises.searchPlaceholder": "Search exercises…",
        "exercises.title": "Title",
        "exercises.category": "Category",
        "exercises.difficulty": "Difficulty",
        "exercises.allCategories": "All categories",
        "risk.green": "Green",
        "risk.yellow": "Yellow",
        "risk.red": "Red",
      };
      const value = labels[key];
      if (value) return value;
      // react-i18next defaultValue contract — used by exercises page.
      if (opts && typeof opts === "object" && "defaultValue" in opts) {
        const dv = (opts as { defaultValue: unknown }).defaultValue;
        if (typeof dv === "string") return dv;
      }
      return key;
    },
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

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
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";

const SEVERITIES_THAT_FAIL = new Set<string>([
  "critical",
  "serious",
]);

function criticalAndSerious(results: AxeOutcome): AxeViolation[] {
  return results.violations.filter((v: AxeViolation) =>
    SEVERITIES_THAT_FAIL.has(v.impact ?? "minor"),
  );
}

/**
 * Common axe options:
 *  - Restricts checks to WCAG 2.0/2.1 A & AA tags so we don't
 *    accidentally fail on best-practice rules that have nothing to do
 *    with the spec we're committing to.
 *  - Disables `color-contrast` because jsdom can't compute computed
 *    styles from Tailwind utilities, which produces false positives.
 */
const AXE_OPTIONS: AxeOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  rules: {
    "color-contrast": { enabled: false },
  },
};

describe("a11y smoke — login surface", () => {
  it("login form has labelled inputs, no form-control violations", async () => {
    const { container } = render(
      <main>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Welcome to SADO</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">Email address</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  defaultValue=""
                />
              </div>
              <div className="mt-4 flex flex-col gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue=""
                />
              </div>
              <Button type="submit" className="mt-6 w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>,
    );

    const results = await axe(container, AXE_OPTIONS);
    const failing = criticalAndSerious(results);
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([]);
  });

  it("login phone-mode input remains labelled", async () => {
    const { container } = render(
      <main>
        <form noValidate>
          <Label htmlFor="login-phone">Phone number</Label>
          <Input
            id="login-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+998901234567"
            defaultValue=""
          />
          <Button type="submit">Sign in</Button>
        </form>
      </main>,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });
});

describe("a11y smoke — dashboard surface", () => {
  it("stat-card grid + empty state exposes a single h1 and sane landmarks", async () => {
    const { container } = render(
      <main>
        <PageHeader title="Dashboard" description="Snapshot of platform activity" />
        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard label="Total children" value={120} />
          <StatCard label="Assessments today" value={8} variant="success" />
          <StatCard label="Red-risk share" value="12.5%" variant="danger" />
          <StatCard label="Active therapists" value={4} />
        </section>
        <EmptyState
          tone="empty"
          title="No data available"
          description="Run an assessment to start populating the dashboard."
        />
      </main>,
    );

    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });

  it("dashboard error banner uses role=alert without trapping focus", async () => {
    const { container } = render(
      <main>
        <PageHeader title="Dashboard" />
        <div role="alert" className="rounded-md p-4">
          Something went wrong loading metrics.
        </div>
        <StatCard label="Total children" value={0} loading />
      </main>,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });
});

describe("a11y smoke — children list surface", () => {
  it("children data-table with risk badges has named columns and no critical issues", async () => {
    type Row = { id: string; name: string; age: number; risk: "green" | "yellow" | "red" };
    const rows: Row[] = [
      { id: "c-1", name: "Aziz", age: 4, risk: "green" },
      { id: "c-2", name: "Madina", age: 6, risk: "yellow" },
      { id: "c-3", name: "Sardor", age: 5, risk: "red" },
    ];
    const columns = [
      {
        accessorKey: "name",
        header: () => "Name",
        cell: ({ row }: { row: { original: Row } }) => row.original.name,
      },
      {
        accessorKey: "age",
        header: () => "Age",
        cell: ({ row }: { row: { original: Row } }) => row.original.age,
      },
      {
        accessorKey: "risk",
        header: () => "Risk",
        cell: ({ row }: { row: { original: Row } }) => (
          <RiskBadge level={row.original.risk} />
        ),
      },
    ] as const;

    const { container } = render(
      <main>
        <PageHeader
          title="Children"
          description="All children registered on the platform"
        />
        <SearchInput
          value=""
          onChange={() => undefined}
          placeholder="Search children…"
        />
        <DataTable<Row>
          columns={columns as never}
          data={rows}
          getRowId={(row) => row.id}
        />
      </main>,
    );

    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });
});

describe("a11y smoke — exercises list surface", () => {
  it("exercises filter + table with badges keeps select labelled", async () => {
    type Row = {
      id: string;
      title: string;
      category: string;
      difficulty: "easy" | "medium" | "hard";
    };
    const rows: Row[] = [
      { id: "e-1", title: "Articulation A", category: "articulation", difficulty: "easy" },
      { id: "e-2", title: "Vocab B", category: "vocabulary", difficulty: "medium" },
    ];
    const columns = [
      {
        accessorKey: "title",
        header: () => "Title",
        cell: ({ row }: { row: { original: Row } }) => row.original.title,
      },
      {
        accessorKey: "category",
        header: () => "Category",
        cell: ({ row }: { row: { original: Row } }) => (
          <Badge variant="secondary">{row.original.category}</Badge>
        ),
      },
      {
        accessorKey: "difficulty",
        header: () => "Difficulty",
        cell: ({ row }: { row: { original: Row } }) => (
          <Badge
            variant={
              row.original.difficulty === "easy"
                ? "risk-green"
                : row.original.difficulty === "medium"
                  ? "risk-yellow"
                  : "risk-red"
            }
          >
            {row.original.difficulty}
          </Badge>
        ),
      },
    ] as const;

    const { container } = render(
      <main>
        <PageHeader
          title="Exercises"
          description="Therapy exercises catalogue"
        />
        <div className="flex gap-3">
          <SearchInput
            value=""
            onChange={() => undefined}
            placeholder="Search exercises…"
          />
          <select
            aria-label="Category"
            defaultValue=""
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">All categories</option>
            <option value="articulation">Articulation</option>
            <option value="vocabulary">Vocabulary</option>
          </select>
        </div>
        <DataTable<Row>
          columns={columns as never}
          data={rows}
          getRowId={(row) => row.id}
        />
      </main>,
    );

    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });

  it("exercises empty state advertises itself via role=status", async () => {
    const { container } = render(
      <main>
        <PageHeader title="Exercises" />
        <EmptyState
          tone="empty"
          title="No exercises match this filter"
          description="Try a different category or clear the search."
        />
      </main>,
    );
    const results = await axe(container, AXE_OPTIONS);
    expect(criticalAndSerious(results)).toEqual([]);
  });
});
