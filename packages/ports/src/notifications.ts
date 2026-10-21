import type { RetryPolicy } from "./schemas/primitives";

// Shared by the box queue and the edge consumer trigger: Cloudflare's maxRetries is
// maxAttempts - 1, so both platforms deliver a notification the same number of times.
export const NOTIFICATION_RETRY: RetryPolicy = {
  maxAttempts: 6,
  delayMs: 60_000,
  backoff: "constant",
};
