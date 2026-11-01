import { ChartNoAxesColumnIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@shopper/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { CellLines } from "../admin/states";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";
import type { ReportKind } from "./types";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

type Column = {
  header: string;
  /** Hidden below this width, as the loaded column is. */
  from?: "sm" | "md" | "lg";
  /** Shown on phones only, standing in for columns that start at `sm`. */
  phone?: true;
  figure?: true;
  /** A name over a small line, such as a product and its SKU. */
  twoLines?: true;
};

const FROM = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

// The headers and breakpoints of each report's table, as its `columns` declare them.
const TABLES: Record<Exclude<ReportKind, "dashboard">, { label: string; columns: Column[] }> = {
  sales: {
    label: "Loading sales",
    columns: [
      { header: "Day" },
      { header: "Sales", figure: true },
      { header: "Items", from: "lg", figure: true },
      { header: "Gross", from: "md", figure: true },
      { header: "Discounts", from: "lg", figure: true },
      { header: "Tax", from: "lg", figure: true },
      { header: "Refunded", from: "md", figure: true },
      { header: "Net sales", figure: true },
      { header: "Basket", from: "lg", figure: true },
    ],
  },
  products: {
    label: "Loading products",
    columns: [
      { header: "Product", twoLines: true },
      { header: "Sold", figure: true },
      { header: "Refunded", from: "lg", figure: true },
      { header: "Revenue", from: "md", figure: true },
      { header: "Cost", from: "lg", figure: true },
      { header: "Margin", figure: true },
      { header: "Margin %", from: "sm", figure: true },
    ],
  },
  stock: {
    label: "Loading dead stock",
    columns: [
      { header: "Product", twoLines: true },
      { header: "On hand", figure: true },
      { header: "Last sold", from: "sm" },
      { header: "Unit cost", from: "md", figure: true },
      { header: "Value", figure: true },
    ],
  },
  branches: {
    label: "Loading the branch comparison",
    columns: [
      { header: "Branch" },
      { header: "Sales", from: "sm", figure: true },
      { header: "Gross", from: "lg", figure: true },
      { header: "Refunded", from: "lg", figure: true },
      { header: "Net sales", figure: true },
      { header: "Basket", from: "md", figure: true },
      { header: "Margin", from: "md", figure: true },
      { header: "Share", figure: true },
    ],
  },
  journal: {
    label: "Loading the journal",
    columns: [
      { header: "Entry", twoLines: true },
      { header: "Dr / Cr", phone: true, figure: true },
      { header: "Debit", from: "sm", figure: true },
      { header: "Credit", from: "sm", figure: true },
    ],
  },
};

// Rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const ROWS = 14;

/**
 * What a report draws before its figures arrive: the toolbar (unless the screen already drew it) and the body, at
 * the sizes they take loaded. The heading and tabs are drawn by `ReportsPage`.
 */
export function ReportSkeleton({
  kind,
  toolbar = true,
}: {
  kind: ReportKind;
  /** False below a toolbar that is already drawn. */
  toolbar?: boolean;
}) {
  return (
    <>
      {toolbar && <ToolbarSkeleton kind={kind} />}
      {kind === "dashboard" ? <DashboardSkeleton /> : <TableBodySkeleton kind={kind} />}
    </>
  );
}

/** The period, the report's own control and Export, as `ReportToolbar` lays them out. */
function ToolbarSkeleton({ kind }: { kind: ReportKind }) {
  const day = kind === "dashboard" || kind === "stock";
  return (
    <div aria-hidden className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap items-end gap-2 max-sm:w-full">
        {day ? (
          <div className="flex flex-col gap-2 max-sm:flex-1">
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-8 w-full sm:w-44" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-sm:w-full sm:flex">
            {["w-10", "w-6"].map((label) => (
              <div key={label} className="flex flex-col gap-2">
                <Skeleton className={`h-3.5 ${label}`} />
                <Skeleton className="h-8 w-full sm:w-40" />
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </div>
      {kind === "sales" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-8 w-36" />
        </div>
      )}
      {kind === "stock" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-20" />
          <div className="flex h-9 items-center gap-4">
            {[0, 1, 2].map((window) => (
              <Skeleton key={window} className="h-4 w-18.75" />
            ))}
          </div>
        </div>
      )}
      <Skeleton className="h-8 w-21.75 sm:ml-auto" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the dashboard"
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, tile) => (
            <div key={tile} className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card className="gap-4">
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TableBodySkeleton({ kind }: { kind: Exclude<ReportKind, "dashboard"> }) {
  const { label, columns } = TABLES[kind];
  const table = (
    <DataTableSkeleton
      label={label}
      className="min-h-52"
      rows={ROWS}
      columns={columns.map(skeletonColumn)}
    />
  );
  if (kind === "sales" || kind === "branches") return table;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {kind === "journal" ? (
        <Skeleton className="h-5 w-72 max-w-full" />
      ) : (
        <Tiles count={kind === "products" ? 4 : 2} />
      )}
      {kind === "products" && <Skeleton className="h-8 w-full sm:max-w-sm" />}
      {table}
    </div>
  );
}

/** A figure tile above a table: its label and its amount. */
function Tiles({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, tile) => (
        <div key={tile} className="rounded-xl border bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

function skeletonColumn(column: Column): DataTableSkeletonColumn {
  const hidden = column.phone ? "sm:hidden" : column.from ? FROM[column.from] : "";
  return {
    header: column.header,
    className: `${hidden} ${column.figure ? "text-right" : ""}`,
    cell: column.twoLines ? (
      <CellLines lines={["h-5 w-40", "h-4 w-28"]} />
    ) : (
      <Skeleton className={column.figure ? "ml-auto h-5 w-20" : "h-5 w-24"} />
    ),
  };
}

/** Nothing to report for the period: say so and what to try. */
export function NothingToReport({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ChartNoAxesColumnIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
