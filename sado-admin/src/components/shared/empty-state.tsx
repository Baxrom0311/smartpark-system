/**
 * Reusable empty / loading / error placeholder for list and detail
 * screens. Provides a single visual language for "nothing to show"
 * states across the dashboard.
 */

import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyTone = "empty" | "error" | "loading";

interface EmptyStateProps {
  tone?: EmptyTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const toneStyles: Record<EmptyTone, string> = {
  empty:
    "border-brand-200 bg-white text-brand-500 dark:border-brand-800 dark:bg-brand-900 dark:text-brand-400",
  error:
    "border-risk-red/30 bg-risk-red/5 text-risk-red",
  loading:
    "border-brand-200 bg-white text-brand-500 dark:border-brand-800 dark:bg-brand-900 dark:text-brand-300",
};

const defaultIcons: Record<EmptyTone, ReactNode> = {
  empty: <Inbox className="h-7 w-7" aria-hidden />,
  error: <AlertCircle className="h-7 w-7" aria-hidden />,
  loading: <Loader2 className="h-7 w-7 animate-spin" aria-hidden />,
};

export function EmptyState({
  tone = "empty",
  title,
  description,
  action,
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center",
        toneStyles[tone],
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-800">
        {icon ?? defaultIcons[tone]}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-xs opacity-80">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
