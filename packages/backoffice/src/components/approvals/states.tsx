import { InboxIcon } from "lucide-react";
import { Card } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../admin/states";

export function NoApprovals() {
  return (
    <EmptyList
      icon={InboxIcon}
      title="Nothing waiting for you"
      description="When a cashier asks a manager to approve a refund or a discount from the till, the request shows here. It waits ten minutes."
    />
  );
}

/** Request cards in the loaded list's shape: the title and its time left, the reason, who asked, then the two buttons. */
export function ApprovalsSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-busy="true"
      aria-label="Loading approvals"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Card
          key={index}
          className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5.5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The heading and its lead above the cards, for the route's own loading. */
export function ApprovalsPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="grid gap-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <ApprovalsSkeleton />
    </div>
  );
}
