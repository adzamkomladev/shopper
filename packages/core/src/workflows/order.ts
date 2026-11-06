import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  WorkflowTimeoutError,
  type Json,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { acceptOrder, confirmHeld, expireOrder, markOrderPaid } from "../orders/flow";
import type { OrderFlowDeps } from "../orders/types";
import { orderParams } from "../schemas/orders/flow";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const day = 86_400_000;

/**
 * One online order (instance id = order id): its stock is held at placement; it waits for `payment.settled` until the
 * hold runs out and expires the order if none came; a paid order waits for the store's `store.accepted`.
 * Day 33 starts the child Payment workflow that sends `payment.settled`.
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
    await record("expired", "completed", expireOrder);
    return;
  }
  await record("paid", "waiting", markOrderPaid);
  // shortcut: a paid order the store never accepts only ends the wait; Day 33's refund path takes it from here.
  const accepted = await waited(
    flow.waitFor("accept", "store.accepted", deps.acceptWithinMs ?? day),
  );
  if (accepted) await record("accepted", "completed", acceptOrder);
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
