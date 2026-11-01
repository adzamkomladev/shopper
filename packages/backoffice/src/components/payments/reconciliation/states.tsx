import { Skeleton } from "@shopper/ui/components/skeleton";
import { usePermissions } from "../../../queries/session/permissions";
import { TileSkeleton } from "../../register/tile";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import { PaymentsPage } from "../page";

/** The tender table, MoMo tiles and shift table of a loaded day, so nothing moves when it arrives. */
export function ReconciliationBodySkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the reconciliation"
    >
      <DataTableSkeleton
        rows={3}
        columns={[
          { header: "Tender", cell: <Skeleton className="h-5 w-10" /> },
          {
            header: "Taken",
            className: "hidden text-right sm:table-cell",
            cell: <Skeleton className="ml-auto h-5 w-20" />,
          },
          {
            header: "Expected",
            className: "hidden text-right lg:table-cell",
            cell: <Skeleton className="ml-auto h-5 w-20" />,
          },
          {
            header: "Declared",
            className: "hidden text-right lg:table-cell",
            cell: <Skeleton className="ml-auto h-5 w-20" />,
          },
          { header: "Variance", cell: <Skeleton className="h-5.5 w-20 rounded-full" /> },
          {
            header: "Settled",
            className: "hidden text-right sm:table-cell",
            cell: <Skeleton className="ml-auto h-5 w-20" />,
          },
        ]}
      />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-5 sm:grid-cols-3">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-20" />
        <DataTableSkeleton
          rows={2}
          columns={[
            { header: "Closed", cell: <Skeleton className="h-5 w-32" /> },
            { header: "Cash", cell: <Skeleton className="h-5.5 w-20 rounded-full" /> },
            {
              header: "Card",
              className: "hidden sm:table-cell",
              cell: <Skeleton className="h-5.5 w-20 rounded-full" />,
            },
            {
              header: "MoMo",
              className: "hidden sm:table-cell",
              cell: <Skeleton className="h-5.5 w-20 rounded-full" />,
            },
          ]}
        />
      </div>
    </div>
  );
}

/** The payments heading and tabs, the day controls, then the body: the loaded screen's whole shape. */
export function ReconciliationSkeleton() {
  const canRefresh = usePermissions()?.includes("payment.reconcile");
  return (
    <PaymentsPage active="reconciliation" action={canRefresh && <Skeleton className="h-8 w-43" />}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-2 max-sm:w-full">
          <div className="flex flex-col gap-2 max-sm:flex-1">
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-8 w-full sm:w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
        <ReconciliationBodySkeleton />
      </div>
    </PaymentsPage>
  );
}
