import { Link } from "@tanstack/react-router";
import { PackageIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";
import { SetupStepLink } from "../../setup/back";

const DESKTOP_ONLY = "hidden md:table-cell";

export function EmptyCatalogue({
  onAdd,
  addRef,
}: {
  onAdd: () => void;
  addRef: React.Ref<HTMLButtonElement>;
}) {
  return (
    <EmptyList
      icon={PackageIcon}
      title="No products yet"
      description="Add your first product, or bring in a whole spreadsheet."
    >
      <Button aria-keyshortcuts="N" ref={addRef} onClick={onAdd}>
        Add product
      </Button>
      <Button asChild variant="outline">
        <Link to="/imports">Import spreadsheet</Link>
      </Button>
      <SetupStepLink step="products" />
    </EmptyList>
  );
}

/** A search (or only a category) found nothing. A search comes first: it is what the user typed. */
export function NoMatch({ query, onClear }: { query?: string; onClear: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{query ? "No products match" : "No products in this category"}</EmptyTitle>
        <EmptyDescription>
          {query
            ? `Nothing found for "${query}". Check the spelling, or clear the search.`
            : "Pick another category, or clear the filter."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClear}>
          {query ? "Clear search" : "Clear filters"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Product",
    className: "whitespace-normal",
    cell: (
      <>
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28 md:hidden" />
      </>
    ),
  },
  { header: "Category", className: DESKTOP_ONLY, cell: <Skeleton className="h-5 w-16" /> },
  { header: "Unit", className: DESKTOP_ONLY, cell: <Skeleton className="h-5 w-14" /> },
  {
    header: "Price",
    className: "text-right",
    cell: <Skeleton className="ml-auto h-5 w-14" />,
  },
  {
    header: "Tax class",
    className: DESKTOP_ONLY,
    cell: <Skeleton className="h-5 w-14 rounded-full" />,
  },
  {
    header: "Online",
    className: DESKTOP_ONLY,
    cell: <Skeleton className="h-5 w-14 rounded-full" />,
  },
];

/** The products table in the loaded one's columns, filling the page as it does. */
export function TableSkeleton() {
  return <DataTableSkeleton label="Loading products" columns={COLUMNS} />;
}

/** Same shape as the loaded screen: heading, toolbar, then the table. */
export function ProductsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-25" />
        <Skeleton className="h-8 w-26" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-8 min-w-0 flex-1 basis-64" />
        <Skeleton className="h-8 w-full sm:w-52" />
      </div>
      <TableSkeleton />
    </div>
  );
}
