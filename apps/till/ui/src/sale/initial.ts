import type { SaleSnapshot } from "./types";

/** What the sale store holds before anyone has signed in, and again whenever another user signs in. */
export const fresh: Omit<SaleSnapshot, "host" | "sync" | "permissions" | "register"> = {
  loading: true,
  view: null,
  held: [],
  receipt: null,
  paymentNotice: null,
  failure: null,
  busy: false,
  search: { query: "", status: "idle", matches: [] },
  feedback: null,
  operationError: null,
  receiptPrint: null,
};
