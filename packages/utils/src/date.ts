/** An ISO instant as a UTC day for people: "3 Oct 2026", or "3 Oct" without the year. Accra keeps UTC. */
export function formatDay(iso: string, year = true): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
