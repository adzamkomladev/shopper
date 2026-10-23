import { formatGHS, money } from "@shopper/money";
import { SHOP_TIME_ZONE } from "../shop/time";

const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** A statement date (YYYY-MM-DD) or a moment, as a shop day like "23 Sep 2026". */
export const statementDay = (iso: string) => day.format(new Date(iso));

/** An amount with a true minus when it is below zero: payments come off the balance. */
export const signedGHS = (amount: number) =>
  amount < 0 ? `−${formatGHS(money(-amount))}` : formatGHS(money(amount));

const KINDS: Record<string, string> = {
  charge: "Purchase on account",
  payment: "Payment",
  credit_note: "Credit note",
  interest: "Interest",
  transfer: "Transfer",
};
const METHODS: Record<string, string> = { cash: "cash", momo: "mobile money", card: "card" };

/** What an entry is called on a customer's statement. */
export function entryName(kind: string, method: string | null) {
  const name = KINDS[kind] ?? "Adjustment";
  const how = method ? METHODS[method] : undefined;
  return how ? `${name} (${how})` : name;
}
