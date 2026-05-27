import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export const Table = forwardRef<
  HTMLTableElement,
  TableHTMLAttributes<HTMLTableElement>
>(function Table({ className, ...props }, ref) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom border-collapse text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn(
        "border-b border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900",
        className,
      )}
      {...props}
    />
  );
});

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn("divide-y divide-brand-100 dark:divide-brand-800", className)}
      {...props}
    />
  );
});

export const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        "transition-colors hover:bg-brand-50/60 dark:hover:bg-brand-800/40",
        className,
      )}
      {...props}
    />
  );
});

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-300",
        className,
      )}
      {...props}
    />
  );
});

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 align-middle text-brand-800 dark:text-brand-100",
        className,
      )}
      {...props}
    />
  );
});
