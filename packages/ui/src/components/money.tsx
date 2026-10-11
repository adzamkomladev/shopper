import { cn } from "cn";
import { formatGHS, type Money as MoneyAmount } from "@shopper/money";

export function Money({ amount, className }: { amount: MoneyAmount; className?: string }) {
  return (
    <span className={cn("block text-right tabular-nums", className)}>{formatGHS(amount)}</span>
  );
}
