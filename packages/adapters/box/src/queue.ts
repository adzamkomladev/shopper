import { messageBody, retryDelay } from "@shopper/ports";
import type { Delivery, Envelope, Queue, QueueHandler, RetryPolicy } from "@shopper/ports";

// ponytail: messages live in memory and are lost on a box restart; the Rivet queue replaces
// this on Day 36. There is no handler timeout either: a handler that never settles hangs the
// box consumer for that message. Add one when a real handler can block.
export function boxQueue(
  policy: RetryPolicy,
  handler: QueueHandler,
): Queue & { idle(): Promise<void> } {
  // Running handlers and scheduled redeliveries, so idle() sees both.
  const work = new Set<Promise<void>>();
  const track = (promise: Promise<void>) => {
    const entry = promise.finally(() => work.delete(entry));
    work.add(entry);
  };

  function deliver(message: Envelope, attempts: number): void {
    let settled = false;
    const delivery: Delivery = {
      message,
      attempts,
      ack: async () => void (settled ||= true),
      retry: async () => {
        if (settled) return;
        settled = true;
        redeliver(message, attempts);
      },
    };
    track(
      (async () => {
        try {
          await handler(delivery);
        } catch (error) {
          console.error({ event: "queue.handler_failed", id: message.id, attempts, error });
        }
        await delivery.retry();
      })(),
    );
  }

  function redeliver(message: Envelope, attempts: number): void {
    if (attempts >= policy.maxAttempts) {
      console.error({ event: "queue.dead_letter", id: message.id, orgId: message.orgId, attempts });
      return;
    }
    track(
      new Promise((resolve) => {
        setTimeout(
          () => {
            deliver(message, attempts + 1);
            resolve();
          },
          retryDelay(policy, attempts),
        ).unref();
      }),
    );
  }

  return {
    policy,
    async send(message) {
      // The body is what a real queue would carry, so the copy is what the handler sees.
      deliver(JSON.parse(messageBody(message)) as Envelope, 1);
    },
    async idle() {
      while (work.size > 0) await Promise.all(work);
    },
  };
}
