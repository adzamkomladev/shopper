const date = new Intl.DateTimeFormat("en-GH", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * The next run day after `now`. Accra keeps UTC all year, so the calendar day there is the UTC day. The scheduled
 * run itself also looks at the last period sent, which the page does not know.
 */
export function nextRun(day: number, now = new Date()) {
  const thisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day);
  const next =
    now.getUTCDate() < day ? thisMonth : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day);
  return date.format(next);
}
