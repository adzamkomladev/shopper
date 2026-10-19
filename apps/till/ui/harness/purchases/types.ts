// Test-only: what a harness scenario changes about the purchases screen.
/** What one scenario changes about the sale, the host and the cashier. */
export type Scenario = {
  /** By line position: `returned` is fully back, `partial` has 2 back, `final` cannot be returned. */
  lines?: Record<number, "final" | "returned" | "partial">;
  windowClosed?: boolean;
  approval?: boolean;
  history?: boolean;
  /** The sale was made on another register. */
  server?: boolean;
  noRefund?: boolean;
  preview?: "loading" | "offline" | "gone";
  refundError?: { code: string; message: string };
  lookup?: "found" | "missing" | "offline" | "failed";
};
