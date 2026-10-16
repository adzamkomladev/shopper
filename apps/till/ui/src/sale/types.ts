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
export type PurchasesSnapshot = {
  status: "idle" | "loading" | "ready" | "empty" | "error" | "offline";
  filters: PurchaseFilters;
  purchases: PurchaseSummary[];
  total: number;
  page: number;
  pageSize: number;
  selected: PurchaseDetails | null;
  error: string | null;
};

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
  dismissFeedback: () => void;
  syncNow: () => void;
  reconnect: () => void;
};

export type PurchaseActions = {
  list: (filters: PurchaseFilters) => void;
  read: (saleId: string) => void;
  clear: () => void;
};

export type { HostStatus };
