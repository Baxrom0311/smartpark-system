import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface InfoRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/**
 * Read-only label/value row used on detail pages. Two columns on
 * larger screens, stacked on mobile.
 */
export function InfoRow({ label, value, className }: InfoRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-brand-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-brand-800",
        className,
      )}
    >
      <dt className="text-xs font-medium uppercase tracking-wider text-brand-500">
        {label}
      </dt>
      <dd className="text-sm text-brand-900 dark:text-brand-100">{value}</dd>
    </div>
  );
}
