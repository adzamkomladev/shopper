import { LockKeyhole, Printer } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { accraDateTime } from "../../purchases/format";
import type { ShiftSnapshot } from "../../shift/types";

/** The open shift at a glance: when and by whom, the float, and what can be done with it. */
export function ShiftDetails({
  shift,
  openedBy,
  canPrintX,
  canClose,
  offline,
  closeRef,
  onPrintX,
  onClose,
}: {
  shift: NonNullable<ShiftSnapshot["current"]>;
  openedBy: string | null;
  canPrintX: boolean;
  canClose: boolean;
  /** The host is gone: closing and printing both need it, and the buttons say so. */
  offline: boolean;
  closeRef: React.Ref<HTMLButtonElement>;
  onPrintX: () => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Shift details"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-lg border bg-card p-4 shadow-sm lg:col-span-2"
    >
      <div className="grid gap-1">
        <p className="text-lg font-semibold">Opened {accraDateTime(shift.openedAt)}</p>
        <p className="text-sm text-muted-foreground">
          {shift.status === "declared" ? "Counted, waiting to close" : "Selling"}
          {openedBy && ` · by ${openedBy}`}
        </p>
      </div>
      <dl className="grid gap-0.5">
        <dt className="text-sm text-muted-foreground">Float</dt>
        <dd className="text-lg font-semibold tabular-nums">{formatGHS(money(shift.float))}</dd>
      </dl>
      {shift.status === "open" && (
        <div className="flex w-full flex-wrap items-center gap-2">
          {canPrintX && (
            <Button
              aria-keyshortcuts="Alt+X"
              aria-describedby={offline ? "shift-offline-block" : undefined}
              disabled={offline}
              onClick={onPrintX}
              size="touch"
              type="button"
              variant="outline"
            >
              <Printer aria-hidden="true" />
              Print X report <Kbd className="max-sm:hidden">Alt+X</Kbd>
            </Button>
          )}
          {canClose && (
            <Button
              aria-describedby={offline ? "shift-offline-block" : undefined}
              aria-keyshortcuts="Alt+Z"
              disabled={offline}
              onClick={onClose}
              ref={closeRef}
              size="touch"
              type="button"
            >
              <LockKeyhole aria-hidden="true" />
              Close shift <Kbd className="max-sm:hidden">Alt+Z</Kbd>
            </Button>
          )}
          {offline && (
            <p className="text-sm text-muted-foreground" id="shift-offline-block">
              Reconnect to close the shift or print reports
            </p>
          )}
        </div>
      )}
    </section>
  );
}
