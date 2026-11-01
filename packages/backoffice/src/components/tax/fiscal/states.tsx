import { FileCheckIcon, PlugZapIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { FiscalSegment } from "../../../schemas/tax/fiscal";
import { CellLines, EmptyList } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

const EMPTY: Record<FiscalSegment, { title: string; description: string }> = {
  all: {
    title: "No fiscal documents yet",
    description:
      "Every VAT invoice and credit note the tills send shows here on its way to the GRA SDC.",
  },
  pending: {
    title: "Nothing is waiting for the SDC",
    description: "Documents wait here while the SDC is unreachable, and are sent in receipt order.",
  },
  accepted: { title: "No accepted documents", description: "Signed documents show here." },
  rejected: {
    title: "Nothing was rejected",
    description: "A document the SDC refuses shows here with its reason.",
  },
  dead: {
    title: "Nothing is dead-lettered",
    description: "A document that failed ten times stops here until you retry it.",
  },
};

export function NoFiscalDocs({ segment, search }: { segment: FiscalSegment; search?: string }) {
  const empty = EMPTY[segment];
  return (
    <EmptyList
      icon={FileCheckIcon}
      title={search ? `No receipt matches “${search}”` : empty.title}
      description={search ? "Check the receipt number and try again." : empty.description}
    />
  );
}

/** Documents are kept but nothing sends them: the SDC is not configured on this server. */
export function SdcNotConnected() {
  return (
    <Alert role="status">
      <PlugZapIcon aria-hidden />
      <AlertTitle>The SDC is not connected</AlertTitle>
      <AlertDescription>
        Sales go on as normal and their documents wait as pending. They are sent in order once the
        GRA SDC is set up.
      </AlertDescription>
    </Alert>
  );
}

// Two-line rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const DOCUMENT_ROWS = 14;
const SEGMENTS = ["w-8", "w-16", "w-18", "w-16", "w-24"];

/**
 * The SDC note, the five segments, the search, the table and the archive of the loaded tab. The note assumes no SDC
 * is connected yet: the usual state until a shop has its GRA certificate.
 */
export function FiscalSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading fiscal documents"
      className="flex min-h-0 flex-1 flex-col gap-6"
    >
      <Skeleton className="h-17 w-full rounded-lg" />
      <div className="flex min-h-80 flex-1 flex-col gap-4">
        <div className="flex h-9 w-full items-center gap-4 border-b">
          {SEGMENTS.map((width) => (
            <Skeleton key={width} className={`h-5 ${width}`} />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <Skeleton className="h-8 w-full max-w-sm" />
          <DataTableSkeleton
            className="min-h-0"
            rows={DOCUMENT_ROWS}
            columns={[
              { header: "Receipt", cell: <CellLines lines={["h-5 w-28", "h-4 w-20"]} /> },
              {
                header: "Branch",
                className: "hidden md:table-cell",
                cell: <Skeleton className="h-5 w-24" />,
              },
              {
                header: "Issued",
                className: "hidden lg:table-cell",
                cell: <Skeleton className="h-5 w-32" />,
              },
              {
                header: "Tries",
                className: "hidden text-right lg:table-cell",
                cell: <Skeleton className="ml-auto h-5 w-4" />,
              },
              { header: "Status", cell: <Skeleton className="h-5 w-20 rounded-full" /> },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <div className="grid gap-1">
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  );
}
