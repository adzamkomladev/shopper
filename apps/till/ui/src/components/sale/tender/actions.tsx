import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";

export function TenderActions({
  amount,
  canSplit,
  canCharge,
  onSplit,
  onCharge,
}: {
  amount: string;
  canSplit: boolean;
  canCharge: boolean;
  onSplit: () => void;
  onCharge: () => void;
}) {
  return (
    <div className="mt-auto grid shrink-0 grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-2">
      <Button
        aria-label="Split"
        aria-keyshortcuts="Alt+4"
        disabled={!canSplit}
        onClick={onSplit}
        size="touch"
        variant="outline"
      >
        Split <Kbd className="hidden sm:inline-flex">Alt+4</Kbd>
      </Button>
      <Button aria-keyshortcuts="F5 Enter" disabled={!canCharge} onClick={onCharge} size="touch">
        <span>Charge {amount}</span>
        <Kbd className="pointer-coarse:inline-flex">F5</Kbd>
      </Button>
    </div>
  );
}
