import { Skeleton } from "@shopper/ui/components/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@shopper/ui/components/table/primitive";
import { PurchaseHead } from "./head";

/**
 * The purchases list while the host reads: the loaded card's own header, row height (a two-line time and
 * receipt cell, 44px) and pager, with blocks where the cells fill in.
 */
export function PurchaseSkeleton() {
  return (
    <section
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
      role="status"
    >
      <span className="sr-only">Loading purchases</span>
      <div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden">
        <Table>
          <PurchaseHead />
          <TableBody>
            {Array.from({ length: 5 }, (_, index) => (
              <TableRow className="hover:bg-transparent" key={index}>
                <TableCell className="px-4">
                  <div className="flex h-11 flex-col justify-center gap-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5.5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="px-4">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center justify-between border-t px-4 py-3"
      >
        <Skeleton className="h-5 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
    </section>
  );
}
