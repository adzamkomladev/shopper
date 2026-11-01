import { cn } from "cn";
import type { DataTableSkeletonColumn } from "#components/table/types";
export type { DataTableSkeletonColumn } from "#components/table/types";
import { Skeleton } from "#components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#components/table/primitive";

type Props = {
  /** What is loading, announced to assistive tech. Leave it out inside a skeleton that already says so. */
  label?: string;
  columns: DataTableSkeletonColumn[];
  /** Enough rows to fill the room by default: the card clips them to the loaded table's box. */
  rows?: number;
  /** Fill the room the loaded table will take, as a long list does. */
  fill?: boolean;
  /** Where the loaded table's own `className` goes, such as a minimum height. */
  className?: string;
};

const FILL_ROWS = 24;

/**
 * `DataTable` as it loads: the same bordered card, muted header and row cells (so rows are as tall
 * as the loaded ones), with a block in each cell. Size the blocks to the text lines they replace.
 */
export function DataTableSkeleton({ label, columns, rows = FILL_ROWS, fill, className }: Props) {
  return (
    <div
      {...(label
        ? { role: "status", "aria-busy": true, "aria-label": label }
        : { "aria-hidden": true })}
      className={cn(
        "min-h-0 overflow-hidden rounded-lg border bg-card shadow-sm",
        fill && "flex flex-1 flex-col",
        className,
      )}
    >
      <Table bare>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index} className={column.className}>
                {column.srOnly ? <span className="sr-only">{column.header}</span> : column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableCell key={index} className={column.className}>
                  {column.cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
