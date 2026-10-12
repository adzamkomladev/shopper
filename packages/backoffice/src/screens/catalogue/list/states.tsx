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
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";

const SKELETON_ROWS = 6;

export function EmptyCatalogue({
  onAdd,
  addRef,
}: {
  onAdd: () => void;
  addRef: React.Ref<HTMLButtonElement>;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No products yet</EmptyTitle>
        <EmptyDescription>
          Add your first product, or bring in a whole spreadsheet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button ref={addRef} onClick={onAdd}>
          Add product
          <Kbd aria-hidden>N</Kbd>
        </Button>
        <Button asChild variant="outline">
          <Link to="/imports">Import spreadsheet</Link>
        </Button>
      </EmptyContent>
    </Empty>
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

export function TableSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading products"
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

/** Same shape as the loaded screen: heading, toolbar, then rows. */
export function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-9 w-full" />
      <TableSkeleton />
    </div>
  );
}
