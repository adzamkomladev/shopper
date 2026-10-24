import { ReceiptTextIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";

/** The heading and tab bar are drawn by the screen; this stands in for the body until its data arrives. */
export function TaxBodySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Nothing was sold or credited in the range: say so and what to try. */
export function NothingTaxed({ what }: { what: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptTextIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No sales in {what}</EmptyTitle>
        <EmptyDescription>
          Pick another range. Sales show here once the tills have sent them.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
