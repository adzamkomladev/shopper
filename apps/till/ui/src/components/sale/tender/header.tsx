import { ArrowLeft } from "lucide-react";
import { formatGHS, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";

export function TenderHeader({
  balance,
  total,
  received,
  itemCount,
  onBack,
}: {
  balance: Money;
  total: Money;
  received: Money;
  itemCount: number;
  onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {balance > 0 ? "Balance due" : "Fully paid"}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight whitespace-nowrap tabular-nums">
          {formatGHS(balance)}
        </p>
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <div className="min-w-0 text-right text-xs text-muted-foreground sm:text-sm">
          <p>Total {formatGHS(total)}</p>
          {received > 0 && <p>Received {formatGHS(received)}</p>}
          <p>{itemCount} items</p>
        </div>
        <Button aria-keyshortcuts="Alt+C" onClick={onBack} size="touch" variant="outline">
          <ArrowLeft aria-hidden="true" /> Cart{" "}
          <Kbd className="pointer-coarse:inline-flex">Alt+C</Kbd>
        </Button>
      </div>
    </div>
  );
}
