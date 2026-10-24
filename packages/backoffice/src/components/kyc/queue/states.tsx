import { ShieldCheckIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import type { Segment } from "../../../lib/kyc/types";
import { EmptyList } from "../../admin/states";
import { FROM_LG, FROM_MD } from "./table";

const EMPTY: Record<Segment, { title: string; description: string }> = {
  review: {
    title: "Nothing is waiting for approval",
    description:
      "A check lands here once the customer's phone is verified and their ID, if any, is on file.",
  },
  open: {
    title: "No checks in progress",
    description:
      "A check stays open while it waits for the code to be entered or for the ID. Start one with the button above.",
  },
  closed: {
    title: "No closed checks yet",
    description: "Approved, rejected and expired checks are kept here.",
  },
};

export function NoChecks({ segment, children }: { segment: Segment; children?: React.ReactNode }) {
  return (
    <EmptyList icon={ShieldCheckIcon} {...EMPTY[segment]}>
      {children}
    </EmptyList>
  );
}

const SKELETON_ROWS = 5;
// Header, hidden-below class and skeleton size of each column, as in the loaded table.
const COLUMNS = [
  ["Phone", "", "h-5 w-28"],
  ["Asked for", `${FROM_MD} text-right`, "h-5 w-20 ml-auto"],
  ["ID", FROM_LG, "h-5 w-44"],
  ["Status", "", "h-6 w-36 rounded-full"],
] as const;

/** The loaded page's own heading, button, tabs and table, with blocks in the cells, so nothing jumps when it arrives. */
export function KycQueueSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading identity checks"
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-96 max-w-full" />
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map(([label, only]) => (
                <TableHead
                  key={label}
                  className={`h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground ${only}`}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <TableRow key={row} className="h-16.5 hover:bg-transparent">
                {COLUMNS.map(([label, only, size]) => (
                  <TableCell key={label} className={`px-4 ${only}`}>
                    <Skeleton className={size} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
