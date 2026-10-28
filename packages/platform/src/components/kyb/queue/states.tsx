import { BadgeCheckIcon } from "lucide-react";
import { EmptyList } from "@shopper/backoffice/kit";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import type { QueueTab } from "../../../schemas/types";
import { FROM_LG, FROM_MD } from "./table";

const EMPTY: Record<QueueTab, { title: string; description: string }> = {
  in_review: {
    title: "Nothing is waiting for review",
    description: "A business lands here once its submission passes the automated checks.",
  },
  checks_failed: {
    title: "No submissions failed their checks",
    description:
      "When a TIN, Ghana Card, document or payout bank fails a check, the shop is told what to fix.",
  },
  approved: {
    title: "No approved businesses yet",
    description:
      "Approved businesses get a Paystack subaccount, so their MoMo collections pay out to them.",
  },
  expired: {
    title: "No lapsed verifications",
    description:
      "A verification lapses when its earliest card or document expires and was not renewed.",
  },
  rejected: {
    title: "No rejected submissions",
    description: "Rejected submissions are kept here with the reason the shop was given.",
  },
};

export function NoCases({ status }: { status: QueueTab }) {
  return <EmptyList icon={BadgeCheckIcon} {...EMPTY[status]} />;
}

const SKELETON_ROWS = 5;
// Header, hidden-below class and skeleton size of each column, as in the loaded table.
const COLUMNS = [
  ["Business", "", "h-9 w-48"],
  ["Submitted", "", "h-5 w-32"],
  ["Documents expire", FROM_MD, "h-5 w-24"],
  ["Payouts", FROM_LG, "h-6 w-28 rounded-full"],
] as const;

/** The loaded page's heading, tabs and table with blocks in the cells, so nothing jumps when it arrives. */
export function KybQueueSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading verifications"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-136 max-w-full" />
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
