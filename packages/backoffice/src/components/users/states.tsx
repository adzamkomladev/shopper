import { Skeleton } from "@shopper/ui/components/skeleton";
import { CellLines } from "../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

const MEMBER_ROWS = 5;

/**
 * The Users screen while it loads: the heading row, the Members tabs and table, at the sizes they take loaded. The
 * members table is capped at `max-h-96`; below lg the action buttons wrap and each row grows to fill it. Invitations
 * are left out: they draw below the members without moving them, and a skeleton taller than the screen would scroll
 * with nothing to focus.
 */
export function UsersSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading users"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <Skeleton className="h-8 w-23" />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Members</h2>
        <div className="flex flex-col gap-3">
          <div className="flex h-9 w-full items-center gap-4 border-b">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <DataTableSkeleton
            className="max-h-96"
            rows={MEMBER_ROWS}
            columns={[
              { header: "Name", cell: <CellLines lines={["h-5 w-36", "h-5.5 w-48"]} /> },
              { header: "Role", cell: <Skeleton className="h-5 w-24" /> },
              {
                header: "Branches",
                className: "hidden md:table-cell",
                cell: <Skeleton className="h-5 w-24" />,
              },
              { header: "", cell: <Skeleton className="ml-auto h-25 w-28 lg:h-7" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
