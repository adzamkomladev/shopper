import { createMaileroo } from "@shopper/auth";
import { buildInfo } from "@shopper/config";
import { deliverNotification } from "@shopper/core/notifications";
import { createArkesel } from "@shopper/core/sms/arkesel";
import { messageBody, NOTIFICATION_RETRY, retryDelay } from "@shopper/ports";
import { cloudflareDatabase } from "./database";
import { cloudflareRenderer } from "./renderer";
import { cloudflareLauncher, cloudflareLoopLauncher } from "./launcher";
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

/**
 * The edge Worker's `queue()` shell: low-stock alerts become SMS through Arkesel, and statements go out by SMS,
 * or by email with the PDF rendered through Browser Run.
 */
export async function cloudflareNotifications(
  batch: MessageBatch<string>,
  env: Pick<
    CloudflareRuntimeEnvironment,
    | "HYPERDRIVE"
    | "ARKESEL_API_KEY"
    | "ARKESEL_SENDER"
    | "ARKESEL_BASE_URL"
    | "MAILEROO_API_KEY"
    | "MAILEROO_FROM"
    | "MAILEROO_ENDPOINT"
    | "SHOPPER_LINK_SECRET"
    | "SHOPPER_AUTH_URL"
    | "BROWSER"
    | "ACCOUNT_FLOWS"
    | "STATEMENT_FLOWS"
    | "NOTIFICATIONS"
    | "MOMO_REFUND"
    | "PAYSTACK_SECRET_KEY"
    | "ONBOARDING_FLOWS"
    | "KYB_FLOWS"
  >,
): Promise<void> {
  const sms =
    env.ARKESEL_API_KEY && env.ARKESEL_SENDER
      ? createArkesel({
          apiKey: env.ARKESEL_API_KEY,
          sender: env.ARKESEL_SENDER,
          baseUrl: env.ARKESEL_BASE_URL || undefined,
        })
      : undefined;
  const mail =
    env.MAILEROO_API_KEY && env.MAILEROO_FROM
      ? createMaileroo({
          apiKey: env.MAILEROO_API_KEY,
          from: env.MAILEROO_FROM,
          endpoint: env.MAILEROO_ENDPOINT || undefined,
        })
      : undefined;
  const connection = await cloudflareDatabase(env.HYPERDRIVE.connectionString);
  try {
    const deps = {
      db: connection.db,
      appVersion: buildInfo.version,
      sms,
      mail,
      renderer: env.BROWSER ? cloudflareRenderer(env.BROWSER) : undefined,
      linkSecret: env.SHOPPER_LINK_SECRET,
      baseUrl: env.SHOPPER_AUTH_URL,
      accounts: env.ACCOUNT_FLOWS ? cloudflareLoopLauncher(env.ACCOUNT_FLOWS, "wake") : undefined,
      statements: env.STATEMENT_FLOWS
        ? cloudflareLoopLauncher(env.STATEMENT_FLOWS, "wake")
        : undefined,
      queue: env.NOTIFICATIONS ? cloudflareQueue(env.NOTIFICATIONS, NOTIFICATION_RETRY) : undefined,
      // A MoMo refund message starts the provider refund; without Paystack it waits and retries.
      refunds:
        env.MOMO_REFUND && env.PAYSTACK_SECRET_KEY
          ? cloudflareLauncher(env.MOMO_REFUND)
          : undefined,
      onboarding: env.ONBOARDING_FLOWS ? cloudflareLauncher(env.ONBOARDING_FLOWS) : undefined,
      // A resubmission after the run ended starts it again.
      kyb: env.KYB_FLOWS ? cloudflareLoopLauncher(env.KYB_FLOWS, "wake") : undefined,
    };
    await cloudflareDeliver(
      batch,
      (delivery) => deliverNotification(deps, delivery),
      NOTIFICATION_RETRY,
    );
  } finally {
    await connection.close();
  }
}
