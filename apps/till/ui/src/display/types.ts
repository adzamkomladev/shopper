import type { DraftView } from "../sale/types";

/** What the customer display shows. It only listens: the one request it sends is the read-only `readDraft`. */
export type DisplaySnapshot = {
  /** No host connection, no signed-in cashier or no open shift: the register is closed to the customer. */
  closed: boolean;
  storeName: string | null;
  view: DraftView | null;
  /** The sale just completed: total and change due, until the screen goes back to idle. */
  sold: { total: number; change: number } | null;
};
