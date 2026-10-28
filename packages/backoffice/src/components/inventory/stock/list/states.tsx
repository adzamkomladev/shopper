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
import { EmptyList } from "../../../admin/states";
import { InventorySkeleton } from "../../states";

const SKELETON_ROWS = 6;

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

export function TableSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading stock"
      className="flex flex-col rounded-lg border"
    >
      <Skeleton className="h-10 rounded-b-none" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** The toolbar's own boxes and wrapping, then the rows, so the table starts where it will. */
export function StockBodySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 min-w-0 flex-1 basis-64" />
        <Skeleton className="h-9 w-full sm:w-48" />
        <Skeleton className="h-9 w-32.5" />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function StockSkeleton() {
  return (
    <InventorySkeleton>
      <StockBodySkeleton />
    </InventorySkeleton>
  );
}
