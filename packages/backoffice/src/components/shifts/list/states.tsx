import { ClockIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { EmptyList } from "../../admin/states";
import { FROM_LG, FROM_MD } from "./table";

const SKELETON_ROWS = 5;

export function NoShifts() {
  return (
    <EmptyList
      icon={ClockIcon}
      title="No closed shifts yet"
      description="A shift is a cashier's turn on a till. When a cashier counts the drawer and closes the shift, it appears here with its Z report."
    />
  );
}

// Header, hidden-below class and skeleton size of each column, as in the loaded table.
const COLUMNS = [
  ["Closed", "", "h-5 w-40 max-sm:h-10 max-sm:w-28"],
  ["Register", FROM_LG, "h-5 w-26"],
  ["Branch", FROM_LG, "h-5 w-24"],
  ["Closed by", FROM_LG, "h-5 w-30"],
  ["Approved by", FROM_LG, "h-5 w-24"],
  ["Expected cash", `${FROM_MD} text-right`, "h-5 w-16 ml-auto"],
  ["Declared cash", `${FROM_MD} text-right`, "h-5 w-16 ml-auto"],
  ["Variance", "", "h-6 w-26 rounded-full"],
] as const;

/** The loaded table's own columns and rows with blocks in the cells, so nothing jumps when it arrives. */
export function ShiftsSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading shifts">
      <Skeleton className="h-9 w-21" />
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
                {COLUMNS.map(([label, only, size], column) => (
                  <TableCell key={label} className={`px-4 ${only}`}>
                    <Skeleton className={size} />
                    {column === 0 && (
                      <Skeleton className="mt-1 h-4 w-48 lg:hidden max-sm:h-7.5 max-sm:w-28" />
                    )}
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
