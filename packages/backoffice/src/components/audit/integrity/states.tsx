import { ShieldCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { CellLines } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

// A shop has its back office chain and a chain per register.
const CHAIN_ROWS = 3;

/** What verifying does. Static, so the loading tab shows it too. */
export function IntegrityNote() {
  return (
    <Alert>
      <ShieldCheckIcon aria-hidden />
      <AlertTitle>Every entry seals the one before it</AlertTitle>
      <AlertDescription>
        Verifying re-hashes a chain from its first entry. A changed, missing or reordered entry
        fails the check and names where. Each day's last entries are also emailed to the owners.
      </AlertDescription>
    </Alert>
  );
}

/** The note and chains table of the loaded tab, so nothing moves when the data arrives. */
export function IntegritySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <IntegrityNote />
      <DataTableSkeleton
        label="Loading the audit chains"
        className="min-h-0"
        rows={CHAIN_ROWS}
        columns={[
          { header: "Chain", cell: <CellLines lines={["h-5 w-28", "h-4 w-20"]} /> },
          {
            header: "Head",
            className: "hidden md:table-cell",
            cell: <Skeleton className="h-5 w-40" />,
          },
          {
            header: "Last anchor",
            className: "hidden lg:table-cell",
            cell: <Skeleton className="h-5 w-32" />,
          },
          { header: "Check", cell: <Skeleton className="h-7 w-16" /> },
        ]}
      />
    </div>
  );
}
