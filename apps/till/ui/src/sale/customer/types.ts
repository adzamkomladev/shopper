import type { BridgeMessage } from "@shopper/sync/bridge";
import type { DraftView, SaleOutcome } from "../types";

/** A customer as the register's own lookup holds them. `pending` means they or an edit have not reached the server. */
export type CustomerRecord = Extract<BridgeMessage, { kind: "customer" }>["customer"];
/** The customer on the basket: what an invoice names. */
export type BasketCustomer = NonNullable<DraftView["customer"]>;
/** What the cashier may type: the customer's own details, no limit and no email. */
export type CustomerFields = Pick<
  CustomerRecord,
  "name" | "phone" | "kind" | "businessName" | "tin"
>;
export type CustomerLookup =
  | { ok: true; customers: CustomerRecord[] }
  | { ok: false; message: string };
export type CustomerSave =
  | { ok: true; customer: CustomerRecord }
  | Extract<SaleOutcome, { ok: false }>;

export type CustomerActions = {
  /** Every customer on this number, newest first, from the register's own copy. Needs no connection. */
  findCustomers: (phone: string) => Promise<CustomerLookup>;
  /** Creates the customer, or edits `id`. Works offline: the register uploads it later. */
  saveCustomer: (fields: CustomerFields, id?: string) => Promise<CustomerSave>;
  /** Puts the customer on the basket, or takes them off with null. */
  attachCustomer: (customerId: string | null) => Promise<SaleOutcome>;
};
