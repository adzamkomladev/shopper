import { buildInfo } from "@shopper/config";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { deliverStockAlert } from "@shopper/core/stock";
import { messageBody, NOTIFICATION_RETRY, retryDelay } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
import type { CloudflareRuntimeEnvironment } from "./runtime/types";
import type { Envelope, Queue, QueueHandler, RetryPolicy } from "@shopper/ports";

export function cloudflareQueue(
  binding: Pick<globalThis.Queue<string>, "send">,
  policy: RetryPolicy,
): Queue {
  return {
    policy,
    // The body is a validated JSON string so every consumer parses the same bytes.
    async send(message) {
      await binding.send(messageBody(message), { contentType: "text" });
    },
  };
}

// Cloudflare acks a message when the batch handler returns, so anything the handler left
// unsettled, or threw on, is retried explicitly and nothing is acked by accident. The first
// ack or retry wins; later calls do nothing, as on the box.
export async function cloudflareDeliver(
  batch: MessageBatch<string>,
  handler: QueueHandler,
  policy: RetryPolicy,
): Promise<void> {
  await Promise.all(
    batch.messages.map(async (raw) => {
      let settled = false;
      const retry = () => {
        if (settled) return;
        settled = true;
        raw.retry({ delaySeconds: Math.ceil(retryDelay(policy, raw.attempts) / 1000) });
      };
      try {
        await handler({
          message: JSON.parse(raw.body) as Envelope,
          attempts: raw.attempts,
          ack: async () => {
            if (settled) return;
            settled = true;
            raw.ack();
          },
          retry: async () => retry(),
        });
      } catch (error) {
        console.error({ event: "queue.handler_failed", id: raw.id, attempts: raw.attempts, error });
      }
      retry();
    }),
  );
}

/** The edge Worker's `queue()` shell: low-stock alerts become SMS through Arkesel. */
export async function cloudflareNotifications(
  batch: MessageBatch<string>,
  env: Pick<
    CloudflareRuntimeEnvironment,
    "HYPERDRIVE" | "ARKESEL_API_KEY" | "ARKESEL_SENDER" | "ARKESEL_BASE_URL"
  >,
): Promise<void> {
  // Without a key every message retries and dead-letters, so a missing secret is never silent.
  if (!env.ARKESEL_API_KEY || !env.ARKESEL_SENDER) return batch.retryAll();
  const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
  try {
    const sms = createArkesel({
      apiKey: env.ARKESEL_API_KEY,
      sender: env.ARKESEL_SENDER,
      baseUrl: env.ARKESEL_BASE_URL || undefined,
    });
    await cloudflareDeliver(
      batch,
      (delivery) => deliverStockAlert(connection.db, sms, delivery, buildInfo.version),
      NOTIFICATION_RETRY,
    );
  } finally {
    await connection.close();
  }
}
