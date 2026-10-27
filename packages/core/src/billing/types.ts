import type { ShopperDatabase } from "@shopper/db-pg";
import type { Money } from "@shopper/money";
import type { Queue } from "@shopper/ports";

/** A hosted checkout for one invoice: its payment page. */
export type BillingCheckout = (input: {
  reference: string;
  amount: Money;
  email: string;
  metadata: Record<string, string>;
}) => Promise<{ url: string }>;

export type BillingDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  queue?: Queue;
  /** Paystack's checkout; without it an invoice is raised with no payment link. */
  paystack?: { initialize: BillingCheckout };
};
