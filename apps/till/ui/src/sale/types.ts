import type { Money } from "@shopper/money";
import type {
  BridgeMessage,
  DraftView as BridgeDraftView,
  HostStatus,
  PurchaseDetails,
  PurchaseSummary,
} from "@shopper/sync/bridge";
import type { HostConnection } from "../connection/types";

export type { PurchaseDetails, PurchaseSummary };
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
export type SaleSync = {
  offline: boolean;
  pendingCount: number;
  canSync: boolean;
  syncing: boolean;
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
  status: "all" | "completed" | "voided" | "pending";
  query: string;
  kind: "all" | TenderKind;
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
};
export type PurchasesSnapshot = {
  status: "idle" | "loading" | "ready" | "empty" | "error" | "offline";
  filters: PurchaseFilters;
  purchases: PurchaseSummary[];
  total: number;
  page: number;
  pageSize: number;
  selected: PurchaseDetails | null;
  error: string | null;
  reprint: ReprintFeedback | null;
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
};

export type AddInput = { code: string } | { productId: string };
export type SaleActions = {
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
  voidSale: (reason: string, draftId?: string, expectedRevision?: number) => void;
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
};

export type { HostStatus };
