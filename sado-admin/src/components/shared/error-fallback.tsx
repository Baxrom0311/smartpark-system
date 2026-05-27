/**
 * Global error fallback rendered by TanStack Router's `errorComponent`.
 *
 * Used at the root route so any uncaught error in a route loader,
 * server query, or component bubbles up to a friendly screen instead of
 * a blank page or unstyled stack trace.
 */

import { Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export interface ErrorFallbackProps {
  error: unknown;
  reset?: () => void;
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const message = extractMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-12 dark:bg-brand-950">
      <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm dark:border-brand-800 dark:bg-brand-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-risk-red/10 text-risk-red">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-brand-900 dark:text-brand-50">
          {t("errors.boundaryTitle")}
        </h1>
        <p className="mt-2 text-sm text-brand-500 dark:text-brand-300">
          {t("errors.boundaryDesc")}
        </p>
        {message && (
          <pre
            className="mt-4 max-h-32 overflow-auto rounded-md bg-brand-100 p-3 text-left text-xs text-brand-700 dark:bg-brand-800 dark:text-brand-200"
            aria-label="error-detail"
          >
            {message}
          </pre>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {reset && (
            <Button onClick={reset} className="gap-2">
              <RotateCw className="h-4 w-4" aria-hidden />
              {t("common.retry")}
            </Button>
          )}
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-brand-300 bg-transparent px-4 text-sm font-medium text-brand-900 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-brand-700 dark:text-brand-100 dark:hover:bg-brand-800"
          >
            {t("errors.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
