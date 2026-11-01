import { BadgeCheckIcon } from "lucide-react";
import { CellLines, EmptyList } from "@shopper/backoffice/kit";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { QueueTab } from "../../../schemas/types";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

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

// Two-line rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const SKELETON_ROWS = 14;
// The five status tabs, one block per label.
const TABS = ["w-20", "w-28", "w-16", "w-14", "w-16"];

/** The loaded page's heading, tabs and table, so nothing jumps when it arrives. */
export function KybQueueSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Business verification</h1>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div aria-hidden className="flex h-9 w-full items-center gap-4 border-b">
          {TABS.map((width) => (
            <Skeleton key={width} className={`h-5 ${width}`} />
          ))}
        </div>
        <DataTableSkeleton
          label="Loading verifications"
          className="min-h-0"
          rows={SKELETON_ROWS}
          columns={[
            { header: "Business", cell: <CellLines lines={["h-5 w-40", "h-4 w-24"]} /> },
            { header: "Submitted", cell: <Skeleton className="h-5 w-32" /> },
            {
              header: "Documents expire",
              className: "hidden md:table-cell",
              cell: <Skeleton className="h-5 w-24" />,
            },
            {
              header: "Payouts",
              className: "hidden lg:table-cell",
              cell: <Skeleton className="h-5 w-28 rounded-full" />,
            },
          ]}
        />
      </div>
    </div>
  );
}
