import type { RetryPolicy } from "@shopper/ports";

// One source for the consumer trigger and the handler: Cloudflare's maxRetries is
// maxAttempts - 1, so both platforms deliver a message the same number of times.
export const notificationPolicy: RetryPolicy = {
  maxAttempts: 6,
  delayMs: 60_000,
  backoff: "constant",
};
