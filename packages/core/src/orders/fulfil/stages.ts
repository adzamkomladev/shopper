import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder, type ShopperTransaction } from "@shopper/db-pg";

type Status = (typeof onlineOrder.$inferSelect)["status"];

/** The workflow wakes an hour before the slot: the order goes to the pickers if the store has not started on it yet. */
export const pickDue = defineCommand({
  name: "order.pick_due",
  async run(tx, ctx, input: { id: string }) {
    const order = await read(tx, ctx.orgId, input.id);
    // An order picked or handed over ahead of its pick hour is still live: the run goes on to its later waits.
    const due = ["accepted", "picking", "ready", "out_for_delivery", "completed"].includes(
      order.status,
    );
    if (order.status === "accepted")
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "order.pick_due",
        payload: { orderId: order.id },
      });
    // An order already picked (or handed over) ahead of its pick hour needs no wait for what has already happened.
    return { due, picked: ["ready", "out_for_delivery", "completed"].includes(order.status) };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** A workflow checkpoint that says whether the order has reached one of these statuses. */
const reached = (name: string, statuses: Status[]) =>
  defineCommand({
    name,
    async run(tx, ctx, input: { id: string }) {
      return { ok: statuses.includes((await read(tx, ctx.orgId, input.id)).status) };
    },
    audit: (input, output) => ({ id: input.id, ...output }),
    details: (input) => ({ entity: "online_order", entityId: input.id }),
  });

export const orderPicked = defineCommand({
  name: "order.picked",
  async run(tx, ctx, input: { id: string }) {
    const { status } = await read(tx, ctx.orgId, input.id);
    return {
      ok: ["ready", "out_for_delivery", "completed"].includes(status),
      handedOver: status === "completed",
    };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
export const orderCompleted = reached("order.completed", ["completed"]);

async function read(tx: ShopperTransaction, orgId: string, id: string) {
  const [order] = await tx
    .select()
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, id)));
  if (!order) throw new Error("Online order not found");
  return order;
}

/** The run is over without the order going all the way: the checkpoint says so, so the tables show a finished process. */
export const orderEnded = defineCommand({
  name: "order.ended",
  async run(tx, ctx, input: { id: string; reason: string }) {
    await read(tx, ctx.orgId, input.id);
    return { reason: input.reason };
  },
  audit: (input) => ({ id: input.id, reason: input.reason }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
