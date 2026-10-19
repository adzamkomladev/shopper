import { CircleCheck, Printer, TriangleAlert } from "lucide-react";
import { ShiftReport } from "@shopper/backoffice/shifts";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { ClosedShift } from "../../../shift/types";

/**
 * The shift just closed: whether its Z went to the printer, then the Z itself. A printer that is down never
 * undoes the close, so the Z is saved and the cashier is shown how to print it again.
 */
export function ClosedView({
  closed,
  offline,
  onReprint,
  onDone,
}: {
  closed: ClosedShift;
  /** The host is gone, so nothing can be printed until it is back. */
  offline: boolean;
  onReprint: () => void;
  onDone: () => void;
}) {
  const Icon = closed.printed ? CircleCheck : TriangleAlert;
  return (
    <div className="grid gap-4">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card p-4 shadow-sm"
        role="status"
      >
        <Icon
          aria-hidden="true"
          className={closed.printed ? "size-6 text-success" : "size-6 text-warning-foreground"}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Shift closed</p>
          <p className="text-sm text-muted-foreground">
            {closed.printed
              ? "Z report printed."
              : "Z saved. It did not print. Reprint it when the printer is ready."}
            {offline && " Reconnect to print."}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            aria-keyshortcuts="Alt+R"
            className="max-sm:flex-1"
            disabled={offline}
            onClick={onReprint}
            size="touch"
            type="button"
            variant={closed.printed ? "outline" : "default"}
          >
            <Printer aria-hidden="true" />
            Reprint Z <Kbd className="max-sm:hidden">Alt+R</Kbd>
          </Button>
          <Button
            aria-keyshortcuts="Escape"
            className="max-sm:flex-1"
            onClick={onDone}
            size="touch"
            type="button"
            variant="outline"
          >
            Done <Kbd className="max-sm:hidden">Esc</Kbd>
          </Button>
        </div>
      </div>
      <ShiftReport approverName={closed.approverName} report={closed.report} />
    </div>
  );
}
