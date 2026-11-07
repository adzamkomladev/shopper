import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  WorkflowTimeoutError,
  type Json,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { acceptOrder, confirmHeld, expireOrder, markOrderPaid } from "../orders/flow";
import { orderCompleted, orderPicked, pickDue } from "../orders/fulfil/stages";
import { refundPaidOrder } from "../orders/payments/refunds/compensate";
import { refundOrderPayment } from "../orders/payments/refunds/send";
import type { CompensationReason, OrderFlowDeps } from "../orders/types";
import { orderParams } from "../schemas/orders/flow";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const hour = 3_600_000;
/** How long the store has to accept a paid order before it is refunded. */
export const ACCEPT_WITHIN_MS = 10 * 60_000;

/** What a store's decision carries: it turned the order down, or cancelled it (its refund is already made). */
type Decision = { declined?: boolean; cancelled?: boolean };

/**
 * One online order (instance id = order id), start to finish:
 * hold → wait `payment.settled` → wait `store.accepted` (ten minutes, else refunded) → sleep until an hour before
 * the slot → pickers are told → wait `picked` (until the slot ends, else refunded) → wait `handed_over` (a day after
 * the slot, else refunded and restocked) → completed.
 * A payment pays and invoices the order in its own transaction before it sends `payment.settled`; a store's decline
 * or cancel refunds in its own command and wakes whichever wait is open, so the run ends without a second refund.
 */
export async function runOnlineOrder(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor" | "sleepUntil">,
  deps: OrderFlowDeps,
  raw: unknown,
) {
  const params = v.parse(orderParams, raw);
  if (params.id !== flow.instanceId) throw new Error("Online order business key mismatch");
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  const record = <T extends Json>(
    step: string,
    status: WorkflowCheckpoint["status"],
    command: (
      db: ShopperDatabase,
      ctx: typeof context,
      input: { id: string },
      at: WorkflowCheckpoint,
    ) => Promise<T>,
  ) =>
    flow.step(step, policy, () =>
      deps.withDatabase((db) =>
        command(db, context, { id: params.id }, checkpoint(params.id, step, status)),
      ),
    );
  // Compensation: the paid order is refunded, its goods go back and its invoice is credited, then the money is sent.
  const giveBack = async (
    step: string,
    reason: CompensationReason,
    sendStep = `${step}-refund`,
  ) => {
    const refunded = await flow.step(step, policy, () =>
      deps.withDatabase((db) =>
        refundPaidOrder(
          db,
          context,
          { id: params.id, reason },
          checkpoint(params.id, step, "completed"),
        ),
      ),
    );
    if (refunded.id)
      await flow.step(sendStep, { ...policy, maxAttempts: 1 }, async () => {
        await refundOrderPayment(deps, refunded.id!, params.orgId);
        return { id: refunded.id };
      });
  };

  const held = await record("held", "waiting", confirmHeld);
  const slotStart = new Date(held.slotStart).getTime();
  const slotEnd = new Date(held.slotEnd).getTime();
  const paid = await waited(
    flow.waitFor(
      "payment",
      "payment.settled",
      Math.max(0, new Date(held.holdExpiresAt).getTime() - Date.now()),
    ),
  );
  if (!paid) {
    const lapsed = await record("expired", "completed", expireOrder);
    // A payment can land in the moment the hold ends; its own transaction decided, so a paid order carries on.
    if (lapsed.moved) return;
  }
  if (!(await record("paid", "waiting", markOrderPaid)).paid) return;

  const decision = await waited(
    flow.waitFor("accept", "store.accepted", deps.acceptWithinMs ?? ACCEPT_WITHIN_MS),
  );
  if (!decision) return await giveBack("unaccepted", "not_accepted", "refund");
  if ((decision as Decision).declined || (decision as Decision).cancelled) return;
  await record("accepted", "waiting", acceptOrder);

  await flow.sleepUntil("pick-due", new Date(slotStart - (deps.pickLeadMs ?? hour)));
  if (!(await record("pick_due", "waiting", pickDue)).due) return;
  const picked = await waited(flow.waitFor("pick", "picked", Math.max(0, slotEnd - Date.now())));
  if (!picked) return await giveBack("unfilled", "not_fulfilled");
  if ((picked as Decision).cancelled) return;
  if (!(await record("picked", "waiting", orderPicked)).ok) return;

  const collectBy = slotEnd + (deps.collectWithinMs ?? 24 * hour);
  const handed = await waited(
    flow.waitFor("hand-over", "handed_over", Math.max(0, collectBy - Date.now())),
  );
  if (!handed) return await giveBack("uncollected", "uncollected");
  if ((handed as Decision).cancelled) return;
  await record("completed", "completed", orderCompleted);
}

/** The event's payload when it came, null when the wait timed out. */
const waited = (wait: Promise<Json>) =>
  wait.then(
    (payload) => payload ?? {},
    (error: unknown) => {
      if (error instanceof WorkflowTimeoutError) return null;
      throw error;
    },
  );

const checkpoint = (
  instanceId: string,
  step: string,
  status: WorkflowCheckpoint["status"],
): WorkflowCheckpoint => ({
  instanceId,
  businessKey: instanceId,
  type: "online-order",
  step,
  status,
});
