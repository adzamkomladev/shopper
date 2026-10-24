/** Today as a shop date (shop time is UTC: Ghana keeps GMT all year). */
export const shopToday = (now = new Date()) => now.toISOString().slice(0, 10);

/** The month before `today`'s, the one usually being filed: "2026-10-24" gives "2026-09". */
export function lastMonth(today: string) {
  const [year, month] = today.split("-").map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}
