import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData> {
  columns: ReadonlyArray<ColumnDef<TData, unknown>>;
  data: ReadonlyArray<TData>;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** Optional id getter so React keys are stable. */
  getRowId?: (row: TData, index: number) => string;
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  error = null,
  emptyMessage,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  getRowId,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const table = useReactTable<TData>({
    data: data as TData[],
    columns: columns as ColumnDef<TData, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-brand-200 bg-white shadow-sm",
        "dark:border-brand-800 dark:bg-brand-900",
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && data.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((_col, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-sm text-risk-red"
              >
                {error}
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-sm text-brand-500"
              >
                {emptyMessage ?? t("common.empty")}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasMore && onLoadMore && (
        <div className="flex justify-center border-t border-brand-100 p-3 dark:border-brand-800">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
