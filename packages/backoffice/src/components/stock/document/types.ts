export type Mode = "count" | "receiving";

/** The words a stock document screen puts on the shared form. */
export type DocumentCopy = {
  quantityLabel: string;
  submit: string;
  emptyTitle: string;
  emptyHint: string;
  queued: string;
};
