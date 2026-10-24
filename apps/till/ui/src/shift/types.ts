import type { CashCounts, XReport, ZReport } from "@shopper/core/schemas";
import type { HostStatus } from "@shopper/sync/bridge";
import type { HostConnection } from "../connection/types";
import type { Approval, ApproverState, ReprintFeedback, SaleOutcome } from "../sale/types";

export type ShiftStatus = NonNullable<HostStatus["shift"]>;
/**
 * What the register may do: `closed` has no shift, `open` can sell, `counting` was counted and waits for its
 * close, and `unknown` is a host that does not report a shift, which blocks nothing.
 */
export type ShiftPhase = "unknown" | "closed" | "open" | "counting";
export type Variance = {
  tender: "cash" | "card" | "momo";
  expected: number;
  declared: number;
  variance: number;
};
export type ReportState =
  | { status: "idle" | "loading" }
  | { status: "ready"; report: XReport }
  | { status: "failed"; message: string };
/** The Z of the shift just closed, and whether the printer took it. */
export type ClosedShift = { report: ZReport; printed: boolean; approverName: string | null };
/** What the count found; `variances` is null when the page was reloaded after the count. */
export type Judgement = { variances: Variance[] | null; threshold: number | null };

export type ShiftSnapshot = {
  host: HostConnection;
  phase: ShiftPhase;
  current: ShiftStatus["current"];
  last: ShiftStatus["last"];
  permissions: string[];
  /** The signed-in user, to name who opened a shift when the X report is not readable. */
  user: { userId: string; name: string } | null;
  printer: HostStatus["printer"]["state"];
  report: ReportState;
  judgement: Judgement | null;
  /** A manager must approve the close: judged over the threshold, or refused for want of one. */
  approvalRequired: boolean;
  closed: ClosedShift | null;
  approvers: ApproverState;
};

export type FloatInput = { float: number } | { counts: CashCounts };
export type ShiftActions = {
  open: (input: FloatInput) => Promise<SaleOutcome>;
  drop: (amount: number, reason?: string) => Promise<SaleOutcome>;
  noSale: (reason: string) => Promise<SaleOutcome>;
  /** Reads the X; `quiet` keeps what is on screen while it refreshes. */
  loadReport: (quiet?: boolean) => void;
  printX: () => Promise<ReprintFeedback>;
  reprintZ: () => Promise<ReprintFeedback>;
  declare: (counts: CashCounts, card: number, momo: number) => Promise<SaleOutcome>;
  close: (approval?: Approval) => Promise<SaleOutcome>;
  /** Who may approve a close; the list is read for `shift.approve`. */
  loadApprovers: () => void;
  /** Forgets the Z that was on screen once the cashier moves on. */
  dismissClosed: () => void;
  reconnect: () => void;
};

/** The notes and coins as typed, one text per face; blanks and zeros are left out when it is parsed. */
export type CountText = Record<string, string>;
export type CloseStep = "count" | "totals";
export type ShiftDialog = "open" | "drop" | "nosale" | "payment";
