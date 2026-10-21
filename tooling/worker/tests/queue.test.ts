import { createExecutionContext, createMessageBatch, env, getQueueResult } from "cloudflare:test";
import { test } from "vitest";
import { cloudflareDeliver, cloudflareQueue } from "@shopper/adapters-cf";
import { queueConformance } from "@shopper/conformance";
import type { Envelope } from "@shopper/ports";

const policy = { maxAttempts: 5, delayMs: 0, backoff: "constant" } as const;

// The consumer trigger is wired in slice 7, so the test plays the queue: it records what the
// real producer binding accepts and feeds each batch to cloudflareDeliver, as the platform would.
queueConformance("Cloudflare queue in workerd", test, async (handler) => {
  const pending: { body: string; attempts: number }[] = [];
  const binding = {
    async send(body: string, options?: QueueSendOptions) {
      await (env as { NOTIFICATIONS: Queue<string> }).NOTIFICATIONS.send(body, options);
      pending.push({ body, attempts: 1 });
    },
  };
  return {
    queue: cloudflareQueue(binding, policy),
    async settle() {
      for (let round = 0; pending.length > 0 && round < policy.maxAttempts; round += 1) {
        const batch = createMessageBatch(
          "shopper-notifications-dev",
          pending.splice(0).map(({ body, attempts }, index) => ({
            id: `${round}-${index}`,
            timestamp: Date.now(),
            attempts,
            body,
          })),
        );
        const ctx = createExecutionContext();
        await cloudflareDeliver(batch as MessageBatch<string>, handler, policy);
        const result = await getQueueResult(batch, ctx);
        for (const { msgId } of result.retryMessages) {
          if (result.explicitAcks.includes(msgId))
            throw new Error(`${msgId} was acked and retried`);
          const message = batch.messages.find((m) => m.id === msgId)!;
          pending.push({ body: message.body as string, attempts: message.attempts + 1 });
        }
      }
    },
  };
});

test("an unsettled message is retried, never silently acked", async () => {
  const body = JSON.stringify({} as Envelope);
  const batch = createMessageBatch("shopper-notifications-dev", [
    { id: "quiet", timestamp: Date.now(), attempts: 1, body },
  ]);
  const ctx = createExecutionContext();
  await cloudflareDeliver(batch as MessageBatch<string>, async () => {}, policy);
  const result = await getQueueResult(batch, ctx);
  if (!result.retryMessages.some((m) => m.msgId === "quiet") || result.ackAll) {
    throw new Error(`expected an explicit retry, got ${JSON.stringify(result)}`);
  }
});
