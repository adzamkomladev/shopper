"use no memo"; // TanStack Table and Virtual return unstable functions that the React Compiler would cache.

import type { DataTableColumn } from "./types";
export type { DataTableColumn } from "./types";

import { useRef, type UIEvent } from "react";
import { metaHelper, tableFeatures, useTable, type RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cn";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#components/table/primitive";

const ROW_HEIGHT = 66;
const OVERSCAN_ROWS = 8;
// Up to this many rows are all rendered: a short list needs no windowing, and every row stays findable.
const VIRTUALIZE_ABOVE_ROWS = 100;
const END_REACHED_ROWS = 10;
export const features = tableFeatures({
  columnMeta: metaHelper<{ align?: "right"; className?: string }>(),
});

type DataTableProps<TData extends RowData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  label: string;
  /**
   * Fires when the last rows come into view: on scroll, and after a render when the rows do not
   * fill the viewport. Fires once per row count, so a failed load is retried only when the count
   * changes.
   */
  onEndReached?: () => void;
  className?: string;
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  label,
  onEndReached,
  className,
}: DataTableProps<TData>) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const reportedAt = useRef(-1);
  const table = useTable({ features, columns, data, getRowId });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: rows.length > VIRTUALIZE_ABOVE_ROWS ? OVERSCAN_ROWS : rows.length,
  });
  const headerRows = table.getHeaderGroups().length;
  const items = virtualizer.getVirtualItems();
  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);

  function checkEnd(node: HTMLDivElement) {
    const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (remaining >= ROW_HEIGHT * END_REACHED_ROWS || reportedAt.current === rows.length) return;
    reportedAt.current = rows.length;
    onEndReached?.();
  }

  // A fresh ref callback each render re-runs the check after the row count changes (no effect).
  function attach(node: HTMLDivElement | null) {
    scroller.current = node;
    if (node) checkEnd(node);
  }

  return (
    <div
      ref={attach}
      onScroll={({ currentTarget }: UIEvent<HTMLDivElement>) => checkEnd(currentTarget)}
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn("relative overflow-auto rounded-lg border bg-card shadow-sm", className)}
    >
      <table aria-rowcount={rows.length + headerRows} className="w-full text-sm">
        <TableHeader className="sticky top-0 z-10 bg-card">
          {table.getHeaderGroups().map((group, index) => (
            <TableRow key={group.id} aria-rowindex={index + 1} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground",
                    header.column.columnDef.meta?.align === "right" && "text-right",
                    header.column.columnDef.meta?.className,
                  )}
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {before > 0 && <SpacerRow height={before} span={columns.length} />}
          {items.map((item) => {
            const row = rows[item.index]!;
            return (
              <TableRow
                key={row.id}
                ref={virtualizer.measureElement}
                data-index={item.index}
                aria-rowindex={item.index + 1 + headerRows}
                className="h-16.5"
              >
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "px-4",
                      cell.column.columnDef.meta?.align === "right" && "text-right",
                      cell.column.columnDef.meta?.className,
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {after > 0 && <SpacerRow height={after} span={columns.length} />}
        </TableBody>
      </table>
    </div>
  );
}

function SpacerRow({ height, span }: { height: number; span: number }) {
  return (
    <tr aria-hidden style={{ height }}>
      <td colSpan={span} className="p-0" />
    </tr>
  );
}
