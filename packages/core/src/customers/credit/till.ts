import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { UploadPrincipal } from "../../sales/types";
import { accountPaymentEvent } from "../../schemas/customers/credit";
import { tillActor } from "./account";
import { recordPayment } from "./payments";

/**
 * Applies one `account.payment` a till took at its drawer, once: a retry under the same id replays. A rejection
 * (`SaleError` or `CustomerError`) is terminal for the till.
 */
export async function acceptAccountPayment(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
  options: { appVersion: string; now?: () => number },
) {
  const { payment } = v.parse(accountPaymentEvent, raw);
  const actor = await tillActor(db, principal, payment, proof, options.appVersion);
  // A till clock running ahead never dates the entry in the future.
  const occurredAt = new Date(
    Math.min((options.now ?? Date.now)(), Date.parse(payment.occurredAt)),
  );
  const done = await recordPayment(db, actor.context, {
    id: payment.customerId,
    body: { id: payment.id, amount: payment.amount, method: payment.method },
    till: {
      principal,
      sessionId: payment.sessionId,
      cashierId: actor.cashierId,
      proofHash: actor.proofHash,
      occurredAt,
      shiftId: payment.shiftId,
      reference: payment.reference,
    },
  });
  return { id: done.entryId, customerId: done.id, replayed: done.replayed };
}
