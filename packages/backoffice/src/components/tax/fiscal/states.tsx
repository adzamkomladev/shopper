import { FileCheckIcon, PlugZapIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { FiscalSegment } from "../../../schemas/tax/fiscal";
import { EmptyList } from "../../admin/states";

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

/** The tabs, search and table of the loaded tab, so nothing moves when the data arrives. */
export function FiscalSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading fiscal documents"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-9 w-full max-w-xl" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
