import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  loading?: boolean;
  variant?: "default" | "warning" | "danger" | "success";
}

const variantClasses: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default:
    "from-brand-50 to-white dark:from-brand-900 dark:to-brand-950",
  success:
    "from-risk-green/10 to-white dark:from-risk-green/20 dark:to-brand-950",
  warning:
    "from-risk-yellow/10 to-white dark:from-risk-yellow/20 dark:to-brand-950",
  danger:
    "from-risk-red/10 to-white dark:from-risk-red/20 dark:to-brand-950",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  loading = false,
  variant = "default",
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden bg-gradient-to-br",
        variantClasses[variant],
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-brand-600 dark:text-brand-300">
              {label}
            </span>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <span className="text-3xl font-bold tracking-tight text-brand-900 dark:text-brand-50">
                {value}
              </span>
            )}
            {trend && !loading && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.value >= 0 ? "text-risk-green" : "text-risk-red",
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%{trend.label ? ` · ${trend.label}` : ""}
              </span>
            )}
          </div>
          {Icon && (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-800 dark:text-brand-200"
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
