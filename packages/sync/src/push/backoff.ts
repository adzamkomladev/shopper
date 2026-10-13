export function retryDeadline(
  now: number,
  attempts: number,
  random: number,
  retryAfter?: string | null,
) {
  const parsed =
    retryAfter &&
    (/^\d+$/.test(retryAfter) ? now + Number(retryAfter) * 1000 : Date.parse(retryAfter));
  const upstream = typeof parsed === "number" && Number.isSafeInteger(parsed) ? parsed : 0;
  return Math.max(
    now + Math.round(Math.min(60_000, 1000 * 2 ** Math.min(attempts, 16)) * (0.5 + 0.5 * random)),
    upstream,
  );
}
