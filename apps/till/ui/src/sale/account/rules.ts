import { formatGHS, money, mulQty, unitsOf, type Money } from "@shopper/money";
import type { AccountView } from "./types";

/** 1240 as "1 240": points are read aloud, so groups are spaced, not comma-separated. */
export const spacedPoints = (points: number) =>
  String(points).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const pointsLabel = (points: number) =>
  `${spacedPoints(points)} ${points === 1 ? "point" : "points"}`;

/** What `points` buy off the sale: one point is worth `pointValue`. */
export const pointsWorth = (points: number, pointValue: number) =>
  mulQty(money(pointValue), points * 1000);

/** A deposit is a balance below zero. */
export const owedOf = (account: AccountView) => money(Math.max(0, account.balance));
export const depositOf = (account: AccountView) => money(Math.max(0, -account.balance));

/** The lesser of what is due and what the customer may still spend. */
export function creditDefault(due: Money, account: AccountView): Money {
  return money(Math.min(due, Math.max(0, account.available)));
}

/** The most points that fit in `due`, or all the customer has when that is less: it never overpays the sale. */
export function pointsDefault(due: Money, account: AccountView): number {
  if (account.pointValue <= 0 || due <= 0) return 0;
  return Math.min(unitsOf(due, money(account.pointValue)), account.points);
}

/** Digits only, as a cashier keys whole points. */
export const pointsText = (text: string) => text.replace(/\D/g, "").slice(0, 9);

/** Why the account tender cannot be taken, in words that carry the amount available; null when it can. */
export function accountProblem(
  kind: "credit" | "loyalty",
  account: AccountView,
  entry: { amount: Money | null; points: number | null; due: Money },
): string | null {
  const over =
    entry.amount !== null && entry.amount > entry.due
      ? `That is more than the balance due, ${formatGHS(entry.due)}`
      : null;
  if (kind === "loyalty") {
    if (!account.loyaltyEnabled) return "Loyalty is off for this shop";
    if (account.points <= 0) return "No points to use";
    if (entry.points !== null && entry.points > account.points)
      return `Only ${pointsLabel(account.points)} available`;
    return over;
  }
  const available = formatGHS(money(Math.max(0, account.available)));
  if (!account.eligible) return "Not eligible for credit. Verify them or take a deposit first";
  if (account.available <= 0) return `Nothing is available on account: ${available}`;
  if (entry.amount !== null && entry.amount > account.available)
    return `Over the limit: ${available} available`;
  return over;
}
