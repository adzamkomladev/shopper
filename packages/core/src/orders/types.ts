import type { orderPayment, ShopperDatabase } from "@shopper/db-pg";
import type { Queue, WorkflowLauncher } from "@shopper/ports";
import type { createHubtel } from "../payments/hubtel/client";
import type { createPaystack } from "../payments/paystack/client";

/** What sending an owed order refund needs: the database and Paystack. */
export type OrderRefundDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  paystack?: Pick<ReturnType<typeof createPaystack>, "refund">;
  appVersion: string;
};

/** What the online order workflow needs from its runtime shell. */
export type OrderFlowDeps = {
  withDatabase: <T>(run: (db: ShopperDatabase) => Promise<T>) => Promise<T>;
  appVersion: string;
  /** Sends a paid order's refund back through Paystack when the store never accepts it. */
  paystack?: OrderRefundDeps["paystack"];
  /** Where the run queues what it must tell people (the pickers, the shopper); read when needed. */
  notifications?: () => Queue | undefined;
  /** How long the store has to accept a paid order; ten minutes unless a test shortens it. */
  acceptWithinMs?: number;
  /** How long before the slot the order goes to the pickers; an hour unless a test shortens it. */
  pickLeadMs?: number;
  /** How long after the slot a picked order may wait to be collected; a day unless a test shortens it. */
  collectWithinMs?: number;
};

/** What one order payment attempt's workflow needs from its runtime shell. */
export type OrderPaymentDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  paystack: Pick<ReturnType<typeof createPaystack>, "charge" | "verify">;
  /** Collects for orgs whose MoMo provider is Hubtel; without it their charges fail with a reason. */
  hubtel?: Pick<ReturnType<typeof createHubtel>, "charge" | "verify">;
  /** The online order's workflow, woken with `payment.settled` when this payment keeps the order. */
  orders: Pick<WorkflowLauncher, "send">;
  appVersion: string;
  /** Where a confirmed payment queues its confirmation (or a refund it owes); read when needed, so a shell can build it later. */
  notifications?: () => Queue | undefined;
  /** How long to wait for the payer before asking the provider once; the order's hold unless a test shortens it. */
  timeoutMs?: number;
};

export type OrderPaymentApplied =
  | { duplicate: true }
  | {
      duplicate: false;
      /** `settled` kept the order; `refund` means the money arrived for an order that could not keep it. */
      outcome: "settled" | "failed" | "refund" | "ignored";
      orderId: string;
    };

/** An order payment attempt as opened, with where the order's receipt email goes. */
export type OrderPaymentStarted = typeof orderPayment.$inferSelect & { email: string | null };

/** Why a paid order is given back to its payer. */
export type CompensationReason =
  | "not_accepted"
  | "declined"
  | "cancelled"
  | "not_fulfilled"
  | "uncollected";
