import { Link } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  GitBranchIcon,
  PackageIcon,
  SearchXIcon,
  TrendingDownIcon,
} from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../../admin/states";
import { InventoryPage } from "../../tabs";
import { FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

export function NoBranch() {
  return (
    <EmptyList
      icon={GitBranchIcon}
      title="Add a branch first"
      description="Stock is kept per branch. Add the place where you sell, then come back to see what is on hand."
    >
      <Button asChild>
        <Link to="/branches">Go to branches</Link>
      </Button>
    </EmptyList>
  );
}

export function NoProducts() {
  return (
    <EmptyList
      icon={PackageIcon}
      title="No products to track yet"
      description="Stock is counted per product. Add your products first, then receive or count them."
    >
      <Button asChild>
        <Link to="/products">Go to products</Link>
      </Button>
    </EmptyList>
  );
}

type NoMatchProps = {
  query?: string;
  filter?: "low" | "negative";
  branchName: string;
  onClear: () => void;
};

/** A search or a filter found nothing. The filter comes first: it is the narrower question. */
export function NoMatch({ query, filter, branchName, onClear }: NoMatchProps) {
  const matching = query ? ` matching "${query}"` : "";
  return (
    <EmptyList
      icon={filter === "negative" ? CircleCheckIcon : filter ? TrendingDownIcon : SearchXIcon}
      title={
        filter === "negative" ? "No negative stock" : filter ? "No low stock" : "No stock matches"
      }
      description={
        filter === "negative"
          ? `Nothing${matching} at ${branchName} has sold below zero.`
          : filter
            ? `Nothing${matching} at ${branchName} is at or under its reorder level.`
            : `Nothing found for "${query}". Check the spelling, or clear the search.`
      }
    >
      <Button variant="outline" onClick={onClear}>
        {filter ? "Clear filters" : "Clear search"}
      </Button>
    </EmptyList>
  );
}

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Product",
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-48" />
        <Skeleton className="my-0.5 h-3 w-28" />
      </div>
    ),
  },
  { header: "On hand", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-16" /> },
  {
    header: "Reorder level",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
  // Most products are neither low nor negative, so most status cells are empty.
  { header: "Status", cell: null },
];

export function TableSkeleton() {
  return <DataTableSkeleton label="Loading stock" columns={COLUMNS} rows={SKELETON_ROWS} fill />;
}

/** The toolbar's own boxes and wrapping, then the rows, so the table starts where it will. */
export function StockBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-8 min-w-0 flex-1 basis-64" />
        <Skeleton className="h-8 w-full sm:w-48" />
        <Skeleton className="h-8 w-23.5" />
        <Skeleton className="h-8 w-21" />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function StockSkeleton() {
  return (
    <InventoryPage active="stock">
      <StockBodySkeleton />
    </InventoryPage>
  );
}
