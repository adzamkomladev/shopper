import { fromDecimal, money, toDecimal } from "@shopper/money";
import { countedCash, DENOMINATIONS, type CashCounts } from "@shopper/core/schemas";
import type { CountText } from "./types";

/** Keeps what a cashier can mean by an amount in cedis: digits and at most two decimals. */
export const cedisText = (text: string) => {
  // A second point ends the amount: "12.5.5" is 12.5, never 12.55.
  const [whole = "", fraction] = text.replace(/[^\d.]/g, "").split(".");
  return fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`;
};

/** Cedis as typed to minor units, or null when it is blank or not an amount. */
export function parseCedis(text: string): number | null {
  const clean = text.trim().replace(/\.$/, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  return Number(fromDecimal(clean));
}

/** Minor units as cedis for a field: 50000 is "5.00". */
export const cedisValue = (amount: number) => toDecimal(money(amount));

export function parseCounts(text: CountText): CashCounts {
  const counts: CashCounts = {};
  for (const face of DENOMINATIONS) {
    const count = Number(text[String(face)] ?? "");
    if (Number.isSafeInteger(count) && count > 0) counts[String(face)] = Math.min(count, 100_000);
  }
  return counts;
}

export const countedTotal = (text: CountText) => Number(countedCash(parseCounts(text)));

/** Something was typed in a box, even if it was 0: that is the cashier saying the drawer holds none of it. */
export const anyCount = (text: CountText) => Object.values(text).some((value) => value !== "");
