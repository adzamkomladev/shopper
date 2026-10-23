import type { Money as MoneyAmount } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import { account } from "../../lib/customers/format";

/** What an account holds, right-aligned like every money column: an amount owed, or money held for them marked "Deposit". */
export function Balance({ balance }: { balance: MoneyAmount }) {
  const { label, amount } = account({ balance });
  return (
    <div className="flex flex-col items-end">
      <Money amount={amount} />
      {label === "Deposit" && <span className="text-xs text-muted-foreground">Deposit</span>}
    </div>
  );
}
