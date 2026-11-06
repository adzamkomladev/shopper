import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  WorkflowTimeoutError,
  type Json,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { acceptOrder, confirmHeld, expireOrder, markOrderPaid } from "../orders/flow";
import { refundPaidOrder } from "../orders/payments/refunds/compensate";
import { refundOrderPayment } from "../orders/payments/refunds/send";
import type { OrderFlowDeps } from "../orders/types";
import { orderParams } from "../schemas/orders/flow";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const day = 86_400_000;

/**
 * One online order (instance id = order id): its stock is held at placement; it waits for `payment.settled` until the
 * hold runs out and expires the order if none came; a paid order waits for the store's `store.accepted` and is
 * refunded if the store never takes it on.
 * A payment that keeps the order pays and invoices it in its own transaction, then sends `payment.settled`.
 */
export async function runOnlineOrder(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
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
  const held = await record("held", "waiting", confirmHeld);
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
  const accepted = await waited(
    flow.waitFor("accept", "store.accepted", deps.acceptWithinMs ?? day),
  );
  if (accepted) return void (await record("accepted", "completed", acceptOrder));
  // Compensation: a paid order the store never took on is refunded, its goods go back and its invoice is credited.
  const refunded = await flow.step("unaccepted", policy, () =>
    deps.withDatabase((db) =>
      refundPaidOrder(
        db,
        context,
        { id: params.id, reason: "not_accepted" },
        checkpoint(params.id, "unaccepted", "completed"),
      ),
    ),
  );
  if (refunded.id)
    await flow.step("refund", { ...policy, maxAttempts: 1 }, async () => {
      await refundOrderPayment(deps, refunded.id!, params.orgId);
      return { id: refunded.id };
    });
}

/** True when the event came, false when the wait timed out. */
const waited = (wait: Promise<unknown>) =>
  wait.then(
    () => true,
    (error: unknown) => {
      if (error instanceof WorkflowTimeoutError) return false;
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
