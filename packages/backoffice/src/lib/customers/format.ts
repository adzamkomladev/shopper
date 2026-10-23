import { sub, money } from "@shopper/money";
import type { CustomerView } from "../../queries/customers/types";
import { SHOP_TIME_ZONE } from "../shop/time";

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const DAY_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "medium",
});
const DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

/** Shop time, like "12 Nov". */
export const shortDay = (iso: string) => DAY.format(new Date(iso));
/** Shop time, like "12 Nov 2026"; a plain date such as "2026-11-12" reads as that day. */
export const fullDay = (iso: string) => DAY_YEAR.format(new Date(iso));
/** Shop time, like "12 Nov 2026, 14:05". */
export const dayTime = (iso: string) => DAY_TIME.format(new Date(iso));

/** The letters in a customer's avatar: the first of their first two words ("Efua Owusu" is EO). */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export const KIND_LABELS: Record<CustomerView["kind"], string> = {
  individual: "Individual",
  business: "Business",
};

/** What the account shows: an amount owed, money held for them, or settled. */
export function account({ balance }: Pick<CustomerView, "balance">) {
  return balance < 0
    ? ({ label: "Deposit", amount: sub(money(0), balance) } as const)
    : ({ label: "Owed", amount: balance } as const);
}

// ponytail: limit - owed, without the amounts tills have set aside for sales in flight (they lapse within the hour).
/** What they can still spend on account: the limit less what they owe, and a deposit adds to it. */
export const available = ({
  creditLimit,
  balance,
}: Pick<CustomerView, "creditLimit" | "balance">) => money(Math.max(0, sub(creditLimit, balance)));

export const ENTRY_LABELS: Record<string, string> = {
  charge: "Sale on account",
  payment: "Payment",
  credit_note: "Credit note",
  interest: "Interest",
  transfer: "Transfer",
};

export const POINTS_LABELS: Record<string, string> = {
  earn: "Earned",
  redeem: "Spent",
  reverse: "Returned sale",
  expire: "Expired",
  transfer: "Transfer",
};
