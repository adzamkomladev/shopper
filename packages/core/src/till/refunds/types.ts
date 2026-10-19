import type { Money } from "@shopper/money";
import type { ReceiptDocument } from "../../schemas/receipts/document";
import type { SaleSnapshot } from "../../schemas/till/sale";
import type { eligibility } from "./eligibility";

/** A sale being refunded: where it was made, what has already gone back, and which products are final sale. */
export type Original = {
  origin: "local" | "server";
  sale: SaleSnapshot;
  occurredAt: string;
  receipt: ReceiptDocument | null;
  /** Refunded quantity per sold line. */
  refunded: Record<string, number>;
  /** Gross already paid back in cash; the next cash payout is rounded on top of it. */
  cashRefunded: Money;
  finalSale: Record<string, boolean>;
};
export type Policy = { returnWindowDays: number; requirePinForReturns: boolean };
export type EligibilityView = ReturnType<typeof eligibility>;
