import { request } from "../connection/store";
import type {
  AccountActions,
  AccountLoad,
  PaymentActions,
  PaymentInput,
  PaymentOutcome,
} from "./account/types";
import type { createSaleOperations } from "./operations";
import { failure, findCustomers } from "./customers";

export async function loadAccount(customerId: string): Promise<AccountLoad> {
  const reply = await request({ type: "customer.account", customerId });
  if (reply?.type === "result" && reply.kind === "account")
    return { ok: true, account: reply.account };
  return { ok: false, ...failure(reply) };
}

export async function payAccount(input: PaymentInput): Promise<PaymentOutcome> {
  const reply = await request({ type: "account.payment", ...input });
  if (reply?.type === "result" && reply.kind === "accountPayment")
    return { ok: true, printed: reply.printed };
  return { ok: false, ...failure(reply) };
}

/** Take account payment: find, read what is owed, and record the cash or MoMo at the drawer. */
export const paymentActions: PaymentActions = {
  find: findCustomers,
  owed: loadAccount,
  pay: payAccount,
};

/** The account tender is the basket's own revisioned call, so a stale basket answers REVISION_STALE like any edit. */
export function accountActions(
  runDraft: ReturnType<typeof createSaleOperations>["runDraft"],
): AccountActions {
  return {
    loadAccount,
    addAccountTender: (input) =>
      runDraft((expectedRevision) => ({ type: "tender.account", expectedRevision, ...input })),
  };
}
