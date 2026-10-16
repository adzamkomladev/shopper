import { Ban, History, Pause } from "lucide-react";
import { formatGHS, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";

export function TenderHeader({
  balance,
  total,
  received,
  itemCount,
  locked,
  hasDraft,
  onHold,
  onShowHeld,
  onVoid,
}: {
  balance: Money;
  total: Money;
  received: Money;
  itemCount: number;
  locked: boolean;
  hasDraft: boolean;
  onHold: () => void;
  onShowHeld: () => void;
  onVoid: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {balance > 0 ? "Balance due" : "Fully paid"}
        </p>
        <p className="mt-1 whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums">
          {formatGHS(balance)}
        </p>
      </div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <div className="min-w-0 text-right text-xs text-muted-foreground sm:text-sm">
          <p>Total {formatGHS(total)}</p>
          {received > 0 && <p>Received {formatGHS(received)}</p>}
          <p>{itemCount} items</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            aria-keyshortcuts="F6"
            aria-label="Hold sale"
            className="h-11 w-11 px-0"
            disabled={locked || !hasDraft}
            onClick={onHold}
            size="touch"
            title="Hold sale (F6)"
            variant="outline"
          >
            <Pause aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-keyshortcuts="F7"
            aria-label="Held sales"
            className="h-11 w-11 px-0"
            disabled={locked}
            onClick={onShowHeld}
            size="touch"
            title="Held sales (F7)"
            variant="outline"
          >
            <History aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-keyshortcuts="F11"
            aria-label="Void sale"
            className="h-11 w-11 px-0"
            disabled={locked || !hasDraft}
            onClick={onVoid}
            size="touch"
            title="Void sale (F11)"
            variant="ghost"
          >
            <Ban aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
