import { gt, isNull, lte, or, type Column } from "drizzle-orm";

/**
 * No retry waits longer than this. Deadlines are wall-clock times kept in the outbox, so one that lies
 * further ahead was set before the clock went back, and is due now instead of hours from now.
 */
export const maxRetryDelayMs = 10 * 60_000;

export function retryDeadline(
  now: number,
  attempts: number,
  random: number,
  retryAfter?: string | null,
) {
  const parsed =
    retryAfter &&
    (/^\d+$/.test(retryAfter) ? now + Number(retryAfter) * 1000 : Date.parse(retryAfter));
  const upstream =
    typeof parsed === "number" && Number.isSafeInteger(parsed)
      ? Math.min(parsed, now + maxRetryDelayMs)
      : 0;
  return Math.max(
    now + Math.round(Math.min(60_000, 1000 * 2 ** Math.min(attempts, 16)) * (0.5 + 0.5 * random)),
    upstream,
  );
}

/** A stored retry deadline that has passed, or that lies further ahead than any retry waits. */
export function retryDue(nextAttemptAt: Column, now: number) {
  return or(
    isNull(nextAttemptAt),
    lte(nextAttemptAt, now),
    gt(nextAttemptAt, now + maxRetryDelayMs),
  );
}

/** The deadline itself, or `now` when it lies further ahead than any retry waits. */
export function dueBy(deadline: number, now: number) {
  return deadline > now + maxRetryDelayMs ? now : deadline;
}
