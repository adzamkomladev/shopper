import { messageBody, retryDelay } from "@shopper/ports";
import type { Delivery, Envelope, Json, Queue, QueueHandler, RetryPolicy } from "@shopper/ports";
import { deliveryParams } from "../schemas/workflows";
import type { Launch } from "../types";

const once = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;

/**
 * A Queue on a workflow engine: every message is a one-shot workflow keyed by its envelope id, each delivery a step
 * and each wait between deliveries an engine sleep, so on Rivet a message and its retries survive a restart.
 * `idle` settles the messages this process sent.
 */
export function launchQueue(
  policy: RetryPolicy,
  handler: QueueHandler,
  launch: Launch,
): Queue & { idle(): Promise<void> } {
  const pending = new Map<string, { done: Promise<void>; resolve: () => void }>();
  const launcher = launch("notification", deliveryParams, async (flow, params) => {
    // messageBody validated the envelope at send.
    const message = params as unknown as Envelope;
    for (let attempts = 1; ; attempts += 1) {
      if (await flow.step(`attempt-${attempts}`, once, () => deliver(handler, message, attempts)))
        break;
      if (attempts >= policy.maxAttempts) {
        console.error({
          event: "queue.dead_letter",
          id: message.id,
          orgId: message.orgId,
          attempts,
        });
        break;
      }
      await flow.sleep(`wait-${attempts}`, retryDelay(policy, attempts));
    }
    pending.get(message.id)?.resolve();
    pending.delete(message.id);
  });
  return {
    policy,
    async send(message) {
      // The body is what a real queue would carry, so the copy is what the handler sees.
      const body = JSON.parse(messageBody(message)) as Json;
      if (!pending.has(message.id)) {
        let resolve = () => {};
        const done = new Promise<void>((settle) => (resolve = settle));
        pending.set(message.id, { done, resolve });
      }
      await launcher.start(message.id, body);
    },
    async idle() {
      while (pending.size) await Promise.all([...pending.values()].map((entry) => entry.done));
    },
  };
}

// One delivery: the first of ack and retry wins; a handler that throws or settles neither is redelivered.
async function deliver(handler: QueueHandler, message: Envelope, attempts: number) {
  let outcome: "ack" | "retry" | undefined;
  const delivery: Delivery = {
    message,
    attempts,
    ack: async () => void (outcome ??= "ack"),
    retry: async () => void (outcome ??= "retry"),
  };
  try {
    await handler(delivery);
  } catch (error) {
    console.error({ event: "queue.handler_failed", id: message.id, attempts, error });
  }
  return outcome === "ack";
}
