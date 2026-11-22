import { onlineOrder, type ShopperDatabase } from "@shopper/db-pg";
import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import type { WorkflowLauncher } from "@shopper/ports";
import { acceptOrder } from "../flow";
import { OrderError } from "../error";
import { refundPaidOrder } from "../payments/refunds/compensate";
import { cancelPlacedOrder, cancelRelayedOrder } from "./cancel";
import { dispatchOrder, handOverOrder } from "./handover";
import { finishPicking } from "./pick";

type Flows = Pick<WorkflowLauncher, "send">;

const gone = () =>
  new OrderError("conflict", "This order has already moved on. Refresh and look again.");

/** The store takes a paid order on; the order's workflow carries on from there. */
export async function acceptStoreOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  if (!(await acceptOrder(db, ctx, { id })).moved) throw gone();
  await flows.send(id, "store.accepted", {});
}

/** The store turns a paid order down: the shopper is refunded at once and the workflow ends. */
export async function declineStoreOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  if (!(await refundPaidOrder(db, ctx, { id, reason: "declined" })).refunded) throw gone();
  await flows.send(id, "store.accepted", { declined: true });
}

/**
 * The store cancels an order it has already been paid for: a full refund, the goods back on the shelf. Whichever
 * wait the workflow is in is woken so the run ends; an order still before its pick time ends at its next step.
 */
export async function cancelStoreOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  const [before] = await db
    .select({ status: onlineOrder.status, channel: onlineOrder.channel })
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, ctx.orgId), eq(onlineOrder.id, id)));
  // A box's relayed order (v1.5 Day 50): its stock goes back here and the relay refunds when it hears.
  if (before?.channel === "relay") {
    if (!(await cancelRelayedOrder(db, ctx, { id })).moved) throw gone();
    return;
  }
  if (!(await refundPaidOrder(db, ctx, { id, reason: "cancelled" })).refunded) throw gone();
  const waiting = { paid: "store.accepted", picking: "picked" } as Record<string, string>;
  const event =
    before!.status === "ready" || before!.status === "out_for_delivery"
      ? "handed_over"
      : waiting[before!.status];
  if (event) await flows.send(id, event, { cancelled: true });
}

/**
 * The shopper gives up an order: one they have not paid for goes back on the shelf; a paid relay order its box has not
 * confirmed by the deadline (v1.5 Day 52) is refunded in full and its workflow woken, as a store cancel would.
 */
export async function cancelOwnOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  if ((await cancelPlacedOrder(db, ctx, { id })).moved) return;
  if (!(await refundPaidOrder(db, ctx, { id, reason: "cancelled", overdue: true })).refunded)
    throw new OrderError("conflict", "This order can no longer be cancelled.");
  await flows.send(id, "store.accepted", { cancelled: true });
}

/** The pick is done: the order is ready for the shopper and its workflow moves on. */
export async function finishStoreOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  const finished = await finishPicking(db, ctx, { id });
  await flows.send(id, "picked", {});
  return finished;
}

/** A delivery leaves the shop. */
export async function dispatchStoreOrder(db: ShopperDatabase, ctx: CommandContext, id: string) {
  await dispatchOrder(db, ctx, { id });
}

/** The shopper has their order; the workflow ends. */
export async function handOverStoreOrder(
  db: ShopperDatabase,
  ctx: CommandContext,
  flows: Flows,
  id: string,
) {
  await handOverOrder(db, ctx, { id });
  await flows.send(id, "handed_over", {});
}
