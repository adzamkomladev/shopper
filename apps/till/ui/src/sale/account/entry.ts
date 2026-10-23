import { fromDecimal, toDecimal, type Money } from "@shopper/money";
import { accountProblem, creditDefault, pointsDefault, pointsWorth } from "./rules";
import type { AccountView, TenderMethod } from "./types";

export function parseAmount(value: string): Money | null {
  try {
    return fromDecimal(value);
  } catch {
    return null;
  }
}

/**
 * What the tender step holds for the selected method: the text in the amount (or points) box, the amount it
 * means and, for On account and Points, why it cannot be taken yet. Typed text wins over the default, which is
 * the lesser of what is due and what is available.
 */
export function tenderEntry({
  kind,
  account,
  balance,
  amountText,
  pointsText,
}: {
  kind: TenderMethod;
  account: AccountView | null;
  balance: Money;
  amountText: string | null;
  pointsText: string | null;
}) {
  const wanted = account && kind === "credit" ? creditDefault(balance, account) : balance;
  const pointsInput = pointsText ?? (account ? String(pointsDefault(balance, account)) : "");
  const points = /^\d+$/.test(pointsInput) ? Number(pointsInput) : null;
  const amount =
    kind === "loyalty"
      ? account && points !== null
        ? pointsWorth(points, account.pointValue)
        : null
      : parseAmount(amountText ?? toDecimal(wanted));
  const accountKind = kind === "credit" || kind === "loyalty" ? kind : null;
  const issue =
    accountKind && account
      ? accountProblem(accountKind, account, { amount, points, due: balance })
      : null;
  return {
    amount,
    points,
    pointsInput,
    amountInput: amountText ?? toDecimal(wanted),
    issue,
    /** On account or Points is selected and cannot be taken yet: no summary, or a problem with the entry. */
    blocked: accountKind !== null && (!account || issue !== null),
  };
}
