import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "risk-green"
  | "risk-yellow"
  | "risk-red";

const variantClasses: Record<Variant, string> = {
  default:
    "bg-brand-600 text-white",
  secondary:
    "bg-brand-100 text-brand-900 dark:bg-brand-800 dark:text-brand-100",
  outline:
    "border border-brand-300 text-brand-800 dark:border-brand-700 dark:text-brand-200",
  "risk-green": "bg-risk-green/15 text-risk-green ring-1 ring-risk-green/30",
  "risk-yellow":
    "bg-risk-yellow/15 text-risk-yellow ring-1 ring-risk-yellow/30",
  "risk-red": "bg-risk-red/15 text-risk-red ring-1 ring-risk-red/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
