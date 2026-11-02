import type { SystemAccount } from "@shopper/db-pg";

/** The account each way of paying lands in. */
export const tenderAccounts = {
  cash: "cash_drawer",
  momo: "momo_clearing",
  card: "card_clearing",
  credit: "receivables",
  loyalty: "loyalty",
} as const satisfies Record<string, SystemAccount>;
