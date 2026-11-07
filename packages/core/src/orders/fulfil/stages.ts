import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { onlineOrder, type ShopperTransaction } from "@shopper/db-pg";

type Status = (typeof onlineOrder.$inferSelect)["status"];

/** The workflow wakes an hour before the slot: the order goes to the pickers if the store still has it. */
export const pickDue = defineCommand({
  name: "order.pick_due",
  async run(tx, ctx, input: { id: string }) {
    const order = await read(tx, ctx.orgId, input.id);
    const due = order.status === "accepted" || order.status === "picking";
    if (due && order.status === "accepted")
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "order.pick_due",
        payload: { orderId: order.id },
      });
    return { due };
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

export const orderPicked = reached("order.picked", ["ready", "out_for_delivery", "completed"]);
export const orderCompleted = reached("order.completed", ["completed"]);

async function read(tx: ShopperTransaction, orgId: string, id: string) {
  const [order] = await tx
    .select()
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, id)));
  if (!order) throw new Error("Online order not found");
  return order;
}
