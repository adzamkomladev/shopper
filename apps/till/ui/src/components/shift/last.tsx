import { CircleCheck, CircleX, Clock, Printer, type LucideIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { accraDateTime } from "../../purchases/format";
import type { ShiftSnapshot } from "../../shift/types";

type Last = NonNullable<ShiftSnapshot["last"]>;

const upload: Record<Last["upload"], { icon: LucideIcon; text: string; tone: string }> = {
  pending: { icon: Clock, text: "Waiting to upload", tone: "text-muted-foreground" },
  accepted: { icon: CircleCheck, text: "Uploaded", tone: "text-success" },
  rejected: { icon: CircleX, text: "Rejected", tone: "text-destructive" },
};

/** The last closed shift: when, whether the office has its Z, and why not when it was turned away. */
export function LastShift({
  last,
  canReprint,
  offline,
  onReprint,
}: {
  last: Last;
  canReprint: boolean;
  offline: boolean;
  onReprint: () => void;
}) {
  const { icon: Icon, text, tone } = upload[last.upload];
  return (
    <section
      aria-label="Last shift"
      className="grid content-start gap-3 rounded-lg border bg-card p-4 shadow-sm"
    >
      <div>
        <h2 className="font-semibold">Last shift</h2>
        <p className="text-sm text-muted-foreground">Closed {accraDateTime(last.closedAt)}</p>
      </div>
      <p className="flex items-start gap-2 text-sm font-medium">
        <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
        <span className="wrap-anywhere">
          {last.upload === "rejected" && last.blockedReason
            ? `${text}: ${last.blockedReason}`
            : text}
        </span>
      </p>
      {canReprint && (
        <Button
          aria-describedby={offline ? "last-offline-block" : undefined}
          aria-keyshortcuts="Alt+R"
          className="w-fit"
          disabled={offline}
          onClick={onReprint}
          size="touch"
          type="button"
          variant="outline"
        >
          <Printer aria-hidden="true" />
          Reprint Z <Kbd className="max-sm:hidden">Alt+R</Kbd>
        </Button>
      )}
      {canReprint && offline && (
        <p className="text-sm text-muted-foreground" id="last-offline-block">
          Reconnect to print
        </p>
      )}
    </section>
  );
}
