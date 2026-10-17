import { CircleCheck, Loader2, Printer, TriangleAlert } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { PrintPhase as Phase, ReceiptPrint, SaleRegister } from "../../../sale/types";

/** Phases where the cashier can print again. */
export const canPrint = (phase: Phase | null) =>
  phase === "failed" || phase === "manual" || phase === "unknown";

/** Where this sale's receipt stands: its own print outcome, never the printer's latest job. */
export function printPhase(register: SaleRegister, print: ReceiptPrint | null): Phase {
  if (register.printer.state === "unconfigured") return "unconfigured";
  if (print?.outcome) return print.outcome;
  return register.printAutomatically ? "printing" : "manual";
}

/** One status line under the sale total, with Print or Reprint when the cashier has to act. */
export function ReceiptPrintStatus({
  phase,
  message,
  reprinting,
  onPrint,
}: {
  phase: Phase;
  message: string | null;
  reprinting: boolean;
  onPrint: () => void;
}) {
  const action = (label: string) => (
    <Button
      aria-disabled={reprinting || undefined}
      aria-keyshortcuts="Alt+R"
      className="aria-disabled:opacity-50"
      onClick={onPrint}
      size="touch"
      type="button"
      variant="outline"
    >
      {reprinting ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <Printer aria-hidden="true" />
      )}
      {reprinting ? "Printing…" : label} <Kbd className="max-sm:hidden">Alt+R</Kbd>
    </Button>
  );
  // The button stays while it prints (aria-disabled, not disabled), so keyboard focus never falls off it.
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm"
      role="status"
    >
      {phase === "printing" && !reprinting && (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Printing receipt…
        </>
      )}
      {phase === "printed" && !reprinting && (
        <>
          <CircleCheck aria-hidden="true" className="size-4 text-success" />
          Receipt printed
        </>
      )}
      {phase === "failed" && (
        <>
          {!reprinting && (
            <span className="flex max-w-prose items-start gap-2 text-left text-destructive">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {message ?? "Print failed"}
            </span>
          )}
          {action("Reprint")}
        </>
      )}
      {phase === "unknown" && (
        <>
          {!reprinting && (
            <span className="flex items-center gap-2 text-warning-foreground">
              <TriangleAlert aria-hidden="true" className="size-4" />
              Print status unknown
            </span>
          )}
          {action("Reprint")}
        </>
      )}
      {phase === "manual" && (
        <>
          {!reprinting && <span className="text-muted-foreground">Not printed</span>}
          {action("Print receipt")}
        </>
      )}
      {phase === "unconfigured" && (
        <span className="text-muted-foreground">
          No printer set up. Add one in Settings <Kbd className="max-sm:hidden">Alt+T</Kbd>
        </span>
      )}
    </div>
  );
}
