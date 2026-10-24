import type { BridgeMessage } from "@shopper/sync/bridge";
import type { Money } from "@shopper/money";
import type { CustomerLookup } from "../customer/types";
import type { SaleOutcome, TenderKind } from "../types";

/** What the tender step can select: the three tenders every sale has, and the two that need a customer and the server. */
export type TenderMethod = TenderKind | "credit" | "loyalty";

/** What the server says the attached customer may spend now. */
export type AccountView = Extract<BridgeMessage, { kind: "account" }>["account"];
/** The read of the attached customer's account the tender step shows; a read for another customer is never shown. */
export type AccountRead = { customerId: string } & (
  | { status: "loading" }
  | { status: "ready"; account: AccountView }
  | { status: "failed"; message: string }
);
export type AccountLoad = { ok: true; account: AccountView } | Extract<SaleOutcome, { ok: false }>;
/** Credit tenders an amount, points whole points; the host settles the worth of points. */
export type AccountTender = { kind: "credit"; amount: Money } | { kind: "loyalty"; points: number };

/** Selling on account and with points: online only, so each is a call to the server through the host. */
export type AccountActions = {
  loadAccount: (customerId: string) => Promise<AccountLoad>;
  /** Holds the credit or points on the server, then puts the tender on the basket. A refusal is inline. */
  addAccountTender: (input: AccountTender) => Promise<SaleOutcome>;
};

export type PaymentInput = {
  customerId: string;
  method: "cash" | "momo";
  amount: number;
  reference?: string;
};
export type PaymentOutcome = { ok: true; printed: boolean } | Extract<SaleOutcome, { ok: false }>;

/** Cash or MoMo paid onto an account at the drawer. Cash works offline; the balance and MoMo need the server. */
export type PaymentActions = {
  find: (phone: string) => Promise<CustomerLookup>;
  owed: AccountActions["loadAccount"];
  pay: (input: PaymentInput) => Promise<PaymentOutcome>;
};
