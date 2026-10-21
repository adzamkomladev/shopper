import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { scopeLabel, SHEET_HEADING_ID } from "../../../../lib/inventory/takes";
import { shiftTime } from "../../../../lib/shifts/format";
import type { TakeDetail } from "../../../../queries/inventory/types";
import { TakeStatus } from "../status";

type Props = {
  take: TakeDetail;
  /** Moves focus to the heading when it first appears, and again whenever a new callback is given. */
  focusRef?: (node: HTMLElement | null) => void;
};

/** The back link, heading, status and who started the take and when. */
export function SheetHeader({ take, focusRef }: Props) {
  const closed =
    take.closedAt &&
    `${take.status === "posted" ? "Posted" : "Cancelled"} ${shiftTime(take.closedAt)}`;
  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
        <Link to="/stock/takes" search={{ branch: take.branchId }}>
          <ArrowLeftIcon aria-hidden />
          Back to stock takes
        </Link>
      </Button>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id={SHEET_HEADING_ID}
            tabIndex={-1}
            ref={focusRef}
            className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
          >
            Stock take
          </h1>
          <TakeStatus status={take.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            take.branchName,
            scopeLabel(take),
            `Started ${shiftTime(take.startedAt)} by ${take.startedByName}`,
            closed,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
