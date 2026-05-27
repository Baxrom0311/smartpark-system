/**
 * Breadcrumbs trail driven by TanStack Router's `useMatches()`.
 *
 * Each route id is mapped to a translation key via {@link CRUMB_LABELS}.
 * Param-bearing detail routes (`$userId`, `$childId`, ...) emit a
 * crumb whose label is the URL parameter itself — this is good enough
 * for an admin tool and avoids a network round-trip for the label.
 *
 * The component intentionally renders nothing (`null`) on top-level
 * routes (dashboard, plain list pages) so we never show a redundant
 * "Dashboard" crumb that simply duplicates the page title.
 */

import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Crumb {
  key: string;
  label: string;
  to: string | null;
}

/**
 * Translation key for each labelled route. Routes not in this map
 * (route-tree internals, the `_authenticated` layout, the dashboard
 * index) are filtered out before rendering.
 */
const CRUMB_LABELS: Readonly<Record<string, string>> = {
  "/_authenticated/users/": "breadcrumb.users",
  "/_authenticated/users/$userId": "breadcrumb.userDetail",
  "/_authenticated/children/": "breadcrumb.children",
  "/_authenticated/children/$childId": "breadcrumb.childDetail",
  "/_authenticated/kindergartens/": "breadcrumb.kindergartens",
  "/_authenticated/kindergartens/$kindergartenId": "breadcrumb.kindergartenDetail",
  "/_authenticated/exercises/": "breadcrumb.exercises",
  "/_authenticated/exercises/$exerciseId": "breadcrumb.exerciseDetail",
  "/_authenticated/notifications/": "breadcrumb.notifications",
  "/_authenticated/statistics/": "breadcrumb.statistics",
  "/_authenticated/settings/": "breadcrumb.settings",
  "/_authenticated/analysis/$assessmentId": "breadcrumb.analysis",
};

/**
 * Routes whose URL contains a param we render as the crumb's literal
 * label (e.g. `/_authenticated/users/$userId` → the user id from the
 * URL). Each entry maps the route id to the param name to read.
 */
const PARAM_ROUTES: Readonly<Record<string, string>> = {
  "/_authenticated/users/$userId": "userId",
  "/_authenticated/children/$childId": "childId",
  "/_authenticated/kindergartens/$kindergartenId": "kindergartenId",
  "/_authenticated/exercises/$exerciseId": "exerciseId",
  "/_authenticated/analysis/$assessmentId": "assessmentId",
};

/**
 * Build the breadcrumbs for the current route.
 *
 * Always prepends the dashboard ("home") crumb on every authenticated
 * page so the user has a one-click escape back to the index. The
 * trail then walks every match down to the leaf.
 */
export function Breadcrumbs() {
  const matches = useMatches();
  const { t } = useTranslation();

  const crumbs = useMemo<Crumb[]>(() => {
    const out: Crumb[] = [];

    // Anchor crumb that points at the dashboard. Always rendered.
    out.push({
      key: "home",
      label: t("breadcrumb.dashboard"),
      to: "/",
    });

    for (const match of matches) {
      const id = match.routeId as string;

      // List route → labelled crumb that links back to itself.
      if (id in CRUMB_LABELS) {
        const labelKey = CRUMB_LABELS[id] ?? "";
        const label = labelKey ? t(labelKey) : "";

        // Param-bearing detail route → label is the literal id from
        // the URL (matches.params already shape-checked by the router).
        if (id in PARAM_ROUTES) {
          const paramName = PARAM_ROUTES[id] ?? "";
          const params = match.params as Record<string, string | undefined>;
          const paramValue =
            (paramName ? params[paramName] : undefined) ?? "";
          out.push({
            key: id,
            label: paramValue || label,
            to: null,
          });
        } else {
          out.push({
            key: id,
            label,
            to: match.pathname || null,
          });
        }
      }
    }

    return out;
  }, [matches, t]);

  // Hide the trail entirely on the dashboard or any unlabelled route —
  // there's nothing useful to show beyond the home anchor.
  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={t("breadcrumb.aria")}
      className="flex items-center gap-1.5 text-xs text-brand-500 dark:text-brand-400"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const content =
            crumb.key === "home" ? (
              <span className="inline-flex items-center gap-1">
                <Home className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{crumb.label}</span>
              </span>
            ) : (
              <span className="font-mono text-brand-700 dark:text-brand-200">
                {crumb.label}
              </span>
            );

          return (
            <li key={crumb.key} className="flex items-center gap-1.5">
              {!isLast && crumb.to ? (
                <Link
                  to={crumb.to}
                  className="rounded transition-colors hover:text-brand-700 dark:hover:text-brand-200"
                  aria-label={crumb.key === "home" ? crumb.label : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {content}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="h-3 w-3 text-brand-400"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
