import { add, money, roundCash, sub, type Money } from "@shopper/money";
import { TillError } from "../error";

export function settle(
  gross: Money,
  tenders: readonly { kind: "cash" | "momo" | "card"; amount: number }[],
  rounding: "none" | "10p",
  selectedKind?: "cash" | "momo" | "card",
) {
  const nonCash = tenders
    .filter((t) => t.kind !== "cash")
    .reduce((sum, t) => add(sum, money(t.amount)), money(0));
  if (nonCash > gross)
    throw new TillError("TENDER_OVERPAID", "Card and MoMo cannot exceed the sale gross");
  const remaining = sub(gross, nonCash);
  const due =
    rounding === "10p" && (selectedKind === "cash" || tenders.some((t) => t.kind === "cash"))
      ? roundCash(remaining, 1000)
      : remaining;
  const roundingLine = sub(due, remaining);
  const cash = tenders
    .filter((t) => t.kind === "cash")
    .reduce((sum, t) => add(sum, money(t.amount)), money(0));
  return {
    gross,
    roundingLine,
    total: add(gross, roundingLine),
    nonCash,
    cash,
    balance: money(Math.max(0, sub(due, cash))),
    change: money(Math.max(0, sub(cash, due))),
  };
}
