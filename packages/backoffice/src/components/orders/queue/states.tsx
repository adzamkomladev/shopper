import { InboxIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import type { DataTableSkeletonColumn } from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../admin/states";
import type { Stage } from "../../../schemas/orders";
import { ORDER_COLUMN_CLASSES } from "./table";
import { StageTabs } from "./tabs";

const EMPTY: Record<Stage, { title: string; description: string }> = {
  new: {
    title: "No orders waiting",
    description:
      "New paid orders appear here. Accept them within ten minutes or they are refunded.",
  },
  preparing: {
    title: "Nothing being prepared",
    description: "Orders you accept wait here until they are picked.",
  },
  ready: {
    title: "Nothing ready",
    description: "Picked orders wait here for the shopper or the rider.",
  },
  done: {
    title: "No finished orders yet",
    description: "Handed-over and refunded orders show here.",
  },
};

export function NoOrders({
  stage,
  searching,
  onClear,
}: {
  stage: Stage;
  searching: boolean;
  onClear: () => void;
}) {
  return searching ? (
    <EmptyList
      icon={SearchXIcon}
      title="Nothing matches this search"
      description="Check the order number or the customer's name, or clear the search."
    >
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </EmptyList>
  ) : (
    <EmptyList icon={InboxIcon} {...EMPTY[stage]} />
  );
}

const COLUMNS: DataTableSkeletonColumn[] = [
  { header: "Order", cell: <Skeleton className="h-5 w-12" /> },
  {
    header: "Slot",
    cell: (
      <>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-14" />
      </>
    ),
  },
  {
    header: "Customer",
    className: ORDER_COLUMN_CLASSES.md,
    cell: <Skeleton className="h-5 w-24" />,
  },
  {
    header: "Handover",
    className: ORDER_COLUMN_CLASSES.lg,
    cell: <Skeleton className="h-5 w-28" />,
  },
  { header: "Items", className: ORDER_COLUMN_CLASSES.lg, cell: <Skeleton className="h-5 w-12" /> },
  { header: "Status", cell: <Skeleton className="h-5 w-16 rounded-full" /> },
  { header: "Total", className: "text-right", cell: <Skeleton className="ml-auto h-5 w-16" /> },
];

/** The table's place while a stage loads: the loaded one's header and rows. */
export function OrderRowsSkeleton() {
  return <DataTableSkeleton label="Loading orders" columns={COLUMNS} />;
}

/** The heading, search, tabs and table of the loaded screen, so nothing moves when the data arrives. */
export function OrdersSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-8 w-64" />
      <StageTabs search={{}}>
        <OrderRowsSkeleton />
      </StageTabs>
    </div>
  );
}
