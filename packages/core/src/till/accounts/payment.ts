import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { money } from "@shopper/money";
import { accountPayment, hostSession, type TillDatabase } from "@shopper/db-sqlite";
import {
  recordAccountPaymentInput,
  type AccountPaymentEvent,
} from "../../schemas/customers/credit";
import { readLookupCustomer } from "../customers/queries";
import { TillError } from "../error";
import { checkSession } from "../session";
import { requireOpenShift } from "../shifts/queries";

/**
 * Cash or MoMo taken on a customer's account at the drawer: kept at once, in the open shift, and queued for the
 * upload lane. Offline is fine, since a payment can only lower what is owed. Needs `sale.create`.
 */
export function recordAccountPayment(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(recordAccountPaymentInput, raw);
  checkSession(input.session, input.scope, "sale.create", input.at);
  return record(db, context, input);
}

const record = defineCommand({
  name: "till.account.payment",
  async run(tx, _context, input: v.InferOutput<typeof recordAccountPaymentInput>) {
    const { scope, session, at } = input;
    const shift = await requireOpenShift(tx, scope);
    const customer = await readLookupCustomer(tx, scope.orgId, input.customerId);
    if (!customer) throw new TillError("CUSTOMER_UNKNOWN", "Unknown customer");
    const id = v7();
    const event: AccountPaymentEvent = {
      v: 1,
      type: "account.payment",
      payment: {
        orgId: scope.orgId,
        sessionId: session.id,
        occurredAt: at.toISOString(),
        id,
        customerId: customer.id,
        shiftId: shift.id,
        method: input.method,
        amount: money(input.amount),
        reference: input.reference,
      },
    };
    // Keeps the session beside the document, as a sale does, so its proof outlives the sign-in.
    await tx.insert(hostSession).values(session).onConflictDoNothing();
    await tx.insert(accountPayment).values({
      id,
      orgId: scope.orgId,
      deviceId: scope.deviceId,
      shiftId: shift.id,
      customerId: customer.id,
      method: input.method,
      amount: input.amount,
      payload: event,
      sessionId: session.id,
      createdAt: at.toISOString(),
    });
    return {
      id,
      customerId: customer.id,
      customerName: customer.name,
      shiftId: shift.id,
      method: input.method,
      amount: input.amount,
      reference: input.reference,
      at: at.toISOString(),
    };
  },
  audit: (_input, output) => ({
    paymentId: output.id,
    customerId: output.customerId,
    shiftId: output.shiftId,
    method: output.method,
    amount: output.amount,
  }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});
