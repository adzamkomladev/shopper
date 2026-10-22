import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { statementDelivery, statementLink, type ShopperTransaction } from "@shopper/db-pg";
import { statementSendInput } from "../../schemas/customers/statements";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";
import { LINK_DAYS } from "./links";

type Target = { id: string; body: unknown };
type Send = v.InferOutput<typeof statementSendInput>;

const output = (row: typeof statementDelivery.$inferSelect, replayed: boolean) => ({
  id: row.id,
  customerId: row.customerId,
  channel: row.channel,
  status: row.status,
  from: row.periodFrom,
  to: row.periodTo,
  linkId: row.linkId,
  replayed,
});

/**
 * Queues a statement for one customer, period and channel, with a link for the customer. Asking again for the same
 * three returns the first delivery and sends nothing; the consumer sends it and marks the row.
 */
export const sendStatement = defineCommand({
  name: "statement.send",
  async replay(tx, ctx, input: Target) {
    const saved = await findDelivery(
      tx,
      ctx.orgId,
      input.id,
      v.parse(statementSendInput, input.body),
    );
    return saved && { output: output(saved, true) };
  },
  async run(tx, ctx, input) {
    const send = v.parse(statementSendInput, input.body);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    if (send.channel === "email" && !current.email)
      throw new CustomerError("NO_CONTACT", "The customer has no email address");
    const [link] = await tx
      .insert(statementLink)
      .values({
        orgId: ctx.orgId,
        customerId: current.id,
        periodFrom: send.from,
        periodTo: send.to,
        expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
        createdBy: ctx.actorId!,
      })
      .returning({ id: statementLink.id });
    const [row] = await tx
      .insert(statementDelivery)
      .values({
        orgId: ctx.orgId,
        customerId: current.id,
        linkId: link!.id,
        channel: send.channel,
        periodFrom: send.from,
        periodTo: send.to,
        actorId: ctx.actorId,
      })
      .returning();
    // Not store-sequenced: the consumer reads the row, not the order.
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId: ctx.orgId,
      v: 1,
      sequence: "0",
      type: "statement.send",
      payload: { deliveryId: row!.id },
    });
    return output(row!, false);
  },
  audit: (_input, result) => ({
    deliveryId: result.id,
    customerId: result.customerId,
    channel: result.channel,
    from: result.from,
    to: result.to,
    linkId: result.linkId,
  }),
  details: (_input, result) => ({ entity: "customer", entityId: result.customerId }),
});

async function findDelivery(tx: ShopperTransaction, orgId: string, customerId: string, send: Send) {
  const [saved] = await tx
    .select()
    .from(statementDelivery)
    .where(
      and(
        eq(statementDelivery.orgId, orgId),
        eq(statementDelivery.customerId, customerId.toLowerCase()),
        eq(statementDelivery.periodFrom, send.from),
        eq(statementDelivery.periodTo, send.to),
        eq(statementDelivery.channel, send.channel),
      ),
    );
  return saved;
}
