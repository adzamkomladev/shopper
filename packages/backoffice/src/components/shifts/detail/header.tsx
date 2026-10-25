import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { focusOnMount } from "../../../lib/focus";
import { shiftTime } from "../../../lib/shifts/format";
import type { ShiftView } from "../../../schemas/shifts";
import { VarianceBadge } from "../list/badge";
import { ChecksBadge, ShiftChecks } from "../list/checks";

/** Where and when the shift ran and who closed it; the Z report below has the figures. */
export function ShiftHeader({ shift }: { shift: ShiftView }) {
  const facts = [
    ["Branch", shift.branchName],
    ["Opened", shiftTime(shift.openedAt)],
    ["Closed", shiftTime(shift.closedAt)],
    ["Closed by", shift.closedByName],
    ["Approved by", shift.approverName ?? "Not needed"],
  ];
  return (
    <header className="flex flex-col gap-3">
      <BackToShifts />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Focused on arrival, so the keyboard continues from the page that was opened. */}
        <h1
          tabIndex={-1}
          ref={focusOnMount}
          className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
        >
          {shift.deviceName}
        </h1>
        <VarianceBadge short={shift.short} over={shift.over} />
        <ChecksBadge checks={shift.checks} />
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm grid-cols-2 lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
      <ShiftChecks checks={shift.checks} />
    </header>
  );
}

/** Known before the shift loads, so the loading skeleton shows it too. */
export function BackToShifts() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
      <Link to="/shifts">
        <ArrowLeftIcon aria-hidden />
        Back to shifts
      </Link>
    </Button>
  );
}
