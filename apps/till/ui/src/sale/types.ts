import type { Money } from "@shopper/money";
import type { HostConnection } from "../connection/types";

// Browser-safe mirror of the draft API (`DraftView` in @shopper/core/till) and of the catalogue
// lookup rows (`CatalogueMatch` in packages/core/src/till/lookup/types.ts). The till UI never
// imports the node-only core package: the bridge parses host replies into these shapes.

export type SaleTotals = {
  base: Money;
  vat: Money;
  nhil: Money;
  getfund: Money;
  covid: Money;
  gross: Money;
  roundingAdjustment: Money;
};

export type TaxRates = { vatBps: number; nhilBps: number; getfundBps: number; covidBps: number };

/** Mirrors TillError codes a quote line can carry when its reference data went away. */
export type LineErrorCode =
  | "PRODUCT_UNKNOWN"
  | "PRICE_MISSING"
  | "TAX_RULE_MISSING"
  | "QUANTITY_INVALID"
  | (string & {});

export type QuoteLine =
  | {
      lineId: string;
      productId: string;
      error?: undefined;
      sku: string;
      name: string;
      baseUnit: string;
      tax: { unitPrice: Money; gross: Money; rule: TaxRates };
    }
  | { lineId: string; productId: string; error: LineErrorCode };

export type DraftLine = {
  id: string;
  productId: string;
  quantityThousandths: number;
  label?: { kind: "weight" | "price"; code: string };
};

/** A draft line joined with its quote, in basket order. */
export type Row = QuoteLine & { line: DraftLine };
export type PricedRow = Row & { error?: undefined };

export type DraftView = {
  draft: { id: string; revision: number; lines: DraftLine[] } | null;
  quote: { lines: QuoteLine[]; totals: SaleTotals };
};

export type CatalogueMatch = {
  productId: string;
  sku: string;
  name: string;
  match: "barcode" | "sku" | "name";
  barcode?: string;
  quantityThousandths?: number;
};

export type SearchState = {
  /** The query these matches answer. A reply for an older query is dropped by the store. */
  query: string;
  status: "idle" | "loading" | "ready" | "failed";
  matches: CatalogueMatch[];
};

/** A basket call that did not apply. Shown until dismissed, or until the next scan. */
export type SaleFeedback =
  | { kind: "unknown"; code: string }
  | { kind: "rejected"; message: string };

/** Why the basket cannot be used right now. The screen disables every edit and explains it. */
export type SaleFailure = "session" | "permission" | "storage";

export type SaleSync = {
  /** The server is unreachable. Sales stay on this register. */
  offline: boolean;
  pendingCount: number;
  canSync: boolean;
  syncing: boolean;
};

/** Everything the screen draws. The Slice 6 store builds it from the bridge. */
export type SaleSnapshot = {
  host: HostConnection;
  loading: boolean;
  view: DraftView | null;
  failure: SaleFailure | null;
  /** A basket call is in flight. Edits wait so none is replayed. */
  busy: boolean;
  search: SearchState;
  feedback: SaleFeedback | null;
  sync: SaleSync;
};

export type AddInput = { code: string } | { productId: string };

/**
 * The only way the screen changes anything. Every method is fire-and-forget: the store serialises
 * the call, then publishes a new snapshot. The Slice 6 bridge wires these to the host.
 */
export type SaleActions = {
  search: (query: string) => void;
  add: (input: AddInput) => void;
  setQuantity: (lineId: string, quantityThousandths: number) => void;
  removeLine: (lineId: string) => void;
  dismissFeedback: () => void;
  syncNow: () => void;
  /** Reopen the host connection, or reload the basket after a storage error. */
  reconnect: () => void;
};
