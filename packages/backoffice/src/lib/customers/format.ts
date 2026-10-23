import { sub, money } from "@shopper/money";
import type { CustomerView } from "../../queries/customers/types";

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
