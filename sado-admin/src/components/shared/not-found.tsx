/**
 * 404 Not Found page for the admin dashboard.
 *
 * Wired into TanStack Router's `notFoundComponent` at the root route so
 * any unmatched URL (and any explicit `notFound()` thrown from a loader)
 * lands here.
 */

import { Link, useRouter } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-12 dark:bg-brand-950">
      <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm dark:border-brand-800 dark:bg-brand-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-200">
          <Compass className="h-7 w-7" aria-hidden />
        </div>
        <p className="font-mono text-5xl font-bold text-brand-300 dark:text-brand-700">
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold text-brand-900 dark:text-brand-50">
          {t("errors.notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-brand-500 dark:text-brand-300">
          {t("errors.notFoundDesc")}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              router.history.back();
            }}
          >
            {t("common.back")}
          </Button>
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-brand-500 dark:hover:bg-brand-400"
          >
            {t("errors.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
