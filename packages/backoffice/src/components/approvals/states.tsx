import { InboxIcon } from "lucide-react";
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

/** Request cards in the loaded list's shape. */
export function ApprovalsSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-busy="true" aria-label="Loading approvals">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl sm:h-24" />
      ))}
    </div>
  );
}
