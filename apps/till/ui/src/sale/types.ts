import type { Ref } from "react";
import type { Money } from "@shopper/money";
import type {
  BridgeMessage,
  DraftView as BridgeDraftView,
  EligibilityView,
  HostStatus,
  PurchaseDetails,
  PurchaseSummary,
} from "@shopper/sync/bridge";
import type { HostConnection } from "../connection/types";
import type { AccountActions } from "./account/types";
import type { CustomerActions } from "./customer/types";

export type { EligibilityView, PurchaseDetails, PurchaseSummary };
export type PurchaseCounts = PurchaseList["counts"];
export type RefundSummary = PurchaseDetails["refunds"][number];
export type DraftView = BridgeDraftView & { settlementError?: string };
export type SaleTotals = DraftView["quote"]["totals"];
type BridgeQuoteLine = DraftView["quote"]["lines"][number];
export type QuoteLine =
  | (Exclude<BridgeQuoteLine, { error: string }> & { error?: undefined })
  | Extract<BridgeQuoteLine, { error: string }>;
export type DraftLine = NonNullable<DraftView["draft"]>["lines"][number];
export type DraftTender = NonNullable<DraftView["draft"]>["tenders"][number];
export type ReceiptDocument = Extract<BridgeMessage, { kind: "sale" }>["receipt"];
export type PaymentNotice = Extract<BridgeMessage, { type: "payment" }>["payment"];
export type PurchaseList = Extract<BridgeMessage, { kind: "purchases" }>;
export type CatalogueMatch = Extract<BridgeMessage, { kind: "search" }>["matches"][number];

export type LineErrorCode = string;
export type Row = QuoteLine & { line: DraftLine };
export type PricedRow = Row & { error?: undefined };
export type SearchState = {
  query: string;
  status: "idle" | "loading" | "ready" | "failed";
  matches: CatalogueMatch[];
};
export type SaleFeedback =
  | { kind: "unknown"; code: string }
  | { kind: "rejected"; message: string };
export type SaleFailure = "session" | "permission" | "storage";
export type SaleSync = Pick<HostStatus, "pendingCount" | "syncing"> & {
  offline: boolean;
  canSync: boolean;
  /** Register clock minus server time; a banner asks for a fix past five minutes. */
  clockSkewMs: number;
};
/** What the sale screen shows when a change is refused: the host's own words, ready to display. */
export type SaleOutcome = { ok: true } | { ok: false; code: string; message: string };
export type ApprovalPermission =
  | "sale.void"
  | "sale.price_override"
  | "refund.approve"
  | "shift.approve";
/** A manager's id and PIN. The host checks the PIN; the screen never keeps it. */
export type Approval = { approverId: string; pin: string };
export type Approver = { userId: string; name: string };
/** Who can approve `permission` on this register, as the host last answered. `stale` lists are empty. */
export type ApproverState = {
  permission: ApprovalPermission | null;
  status: "idle" | "loading" | "ready" | "failed";
  approvers: Approver[];
  stale: boolean;
};
export type PriceInput = {
  lineId: string;
  unitPrice: Money;
  reason: string;
  approval?: Approval;
};
export type TenderKind = "cash" | "momo" | "card";
export type TenderInput =
  | { kind: "cash"; amount: Money }
  | { kind: "card"; amount: Money; approvalCode: string; last4?: string };
export type MomoInput = {
  phone: string;
  network: "mtn" | "telecel" | "airteltigo";
  amount: Money;
};
export type PurchaseFilters = {
  status: "all" | "completed" | "returned" | "voided" | "pending";
  query: string;
  kind: "all" | TenderKind | "credit" | "loyalty";
  page: number;
  pageSize: number;
};
/** A reprint from the purchase detail: what it is doing, or its outcome in words the screen shows as is. */
export type ReprintFeedback = { status: "running" | "done" | "failed"; message: string | null };
/** What the purchase detail needs from the register to reprint and preview a receipt. */
export type PurchaseOutput = {
  printer: HostStatus["printer"]["state"];
  paperMm: 58 | 80;
  canReprint: boolean;
  /** The cashier holds `refund.request`. */
  canRefund: boolean;
};
/** Looking a receipt up on the server, from the "Find on server" row. */
export type PurchaseLookup = {
  status: "idle" | "loading" | "missing" | "offline" | "failed";
  receipt: string;
  message: string | null;
};
/** The return screen's fresh check of what may still go back; null while the detail is showing. */
export type ReturnState =
  | { status: "loading" }
  | { status: "ready"; eligibility: EligibilityView }
  | { status: "failed"; code: string; message: string };
export type RefundTender = { kind: "cash" } | { kind: "card" | "momo"; reference: string };
export type RefundKind = RefundTender["kind"];
/** What refunding some quantities takes back: the lines before tax, the tax, and the gross. */
export type RefundPreview = { base: Money; tax: Money; gross: Money };
/** A held sale being voided from the held-sales dialog: that dialog stays the only one open. */
export type HeldVoidTarget = { name: string; onBack: () => void; formRef: Ref<HTMLFormElement> };
export type RefundInput = {
  lines: { lineId: string; quantityThousandths: number }[];
  reason: string;
  tender: RefundTender;
  approval?: Approval | { approvalId: string };
};
/** `total` is what the register paid out, after cash rounding. */
export type RefundOutcome = { ok: true; total: number } | Extract<SaleOutcome, { ok: false }>;
export type PurchasesSnapshot = {
  status: "idle" | "loading" | "ready" | "empty" | "error" | "offline";
  filters: PurchaseFilters;
  purchases: PurchaseSummary[];
  total: number;
  page: number;
  pageSize: number;
  /** Per tab, for the rows matching the search and tender kind. */
  counts: PurchaseCounts;
  selected: PurchaseDetails | null;
  error: string | null;
  reprint: ReprintFeedback | null;
  lookup: PurchaseLookup;
  returning: ReturnState | null;
  approvers: ApproverState;
};

/** The register settings and printer status the completion view needs. */
export type SaleRegister = {
  clearCartAfterSale: boolean;
  printAutomatically: boolean;
  printer: HostStatus["printer"];
};

/**
 * How this sale's receipt print went. `outcome` stays null while it is pending and is kept once seen,
 * so another job on the printer never changes it. `message` is ready to show.
 */
export type ReceiptPrint = {
  saleId: string;
  outcome: "printed" | "failed" | "unknown" | null;
  message: string | null;
};

/** What the completion view says about the receipt. */
export type PrintPhase = "printing" | "printed" | "failed" | "unknown" | "manual" | "unconfigured";

export type SaleSnapshot = {
  host: HostConnection;
  loading: boolean;
  view: DraftView | null;
  held: DraftView[];
  receipt: ReceiptDocument | null;
  paymentNotice: PaymentNotice | null;
  failure: SaleFailure | null;
  busy: boolean;
  search: SearchState;
  feedback: SaleFeedback | null;
  operationError: string | null;
  permissions: string[];
  sync: SaleSync;
  /** Null until the host has answered. */
  register: SaleRegister | null;
  /** The completed sale's print, null when no sale is showing. */
  receiptPrint: ReceiptPrint | null;
  approvers: ApproverState;
};

export type AddInput = { code: string } | { productId: string };
export type SaleActions = CustomerActions &
  AccountActions & {
    search: (query: string) => void;
    add: (input: AddInput) => void;
    setQuantity: (lineId: string, quantityThousandths: number) => void;
    removeLine: (lineId: string) => void;
    addTender: (input: TenderInput) => void;
    charge: (input: TenderInput) => void;
    complete: () => void;
    removeTender: (tenderId: string) => void;
    startMomo: (input: MomoInput) => void;
    submitMomoOtp: (input: { reference: string; otp: string }) => void;
    hold: (name?: string) => void;
    listHeld: () => void;
    resume: (draftId: string, expectedRevision: number) => void;
    /** Resolves with the outcome so a dialog can stay open on a wrong PIN. */
    voidSale: (
      reason: string,
      draftId?: string,
      expectedRevision?: number,
      approval?: Approval,
    ) => Promise<SaleOutcome>;
    priceLine: (input: PriceInput) => Promise<SaleOutcome>;
    loadApprovers: (permission: ApprovalPermission) => void;
    newSale: () => void;
    /** Starts a new sale from the completion view with the scanned item already in it. */
    newSaleWith: (input: AddInput) => void;
    /** Prints (or reprints) the receipt of a completed sale. */
    print: (saleId: string) => Promise<ReprintFeedback>;
    dismissFeedback: () => void;
    syncNow: () => void;
    reconnect: () => void;
  };

export type PurchaseActions = {
  list: (filters: PurchaseFilters) => void;
  read: (saleId: string) => void;
  clear: () => void;
  /** Resolves with the outcome, so the screen can toast it as well as show it inline. */
  reprint: (saleId: string) => Promise<ReprintFeedback>;
  /** Opens a sale of this store by its receipt number, from this register or another one. */
  lookup: (receipt: string) => void;
  /** Opens the return screen and asks the host what may still go back. */
  startReturn: (purchase: PurchaseDetails) => void;
  endReturn: () => void;
  /** Resolves with the outcome so the return screen can stay open on a refusal; success shows the refreshed sale. */
  refund: (purchase: PurchaseDetails, input: RefundInput) => Promise<RefundOutcome>;
  loadApprovers: (permission: ApprovalPermission) => void;
};

export type { HostStatus };

/** Hold, held sales and void: shared by the sale tiles, Clear cart, their shortcuts and the dialogs. */
export type SaleControls = {
  hasDraft: boolean;
  locked: boolean;
  heldOpen: boolean;
  voidOpen: boolean;
  notice: string;
  hold: () => void;
  showHeld: () => void;
  /** Why a void needs a manager: cash or card was taken, or the cashier cannot void. Null when they may void alone. */
  voidApproval: "cash" | "card" | "permission" | null;
  askVoid: () => void;
  confirmVoid: (reason: string, approval?: Approval) => Promise<SaleOutcome>;
  setHeldOpen: (open: boolean) => void;
  setVoidOpen: (open: boolean) => void;
  setNotice: (notice: string) => void;
};
