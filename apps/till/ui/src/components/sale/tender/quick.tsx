import { formatGHS, money, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";

export function QuickCash({
  balance,
  onSelect,
  onBackspace,
}: {
  balance: Money;
  onSelect: (amount: Money) => void;
  onBackspace: () => void;
}) {
  const notes = [500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 5_000_000]
    .map(money)
    .filter((amount) => amount > balance)
    .slice(0, 2);
  const amounts = [balance, ...notes];
  return (
    <div className="col-span-2 grid content-start gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground">Quick cash</p>
      {amounts.map((amount, index) => (
        <Button
          key={amount}
          className="h-11 tabular-nums"
          onClick={() => onSelect(amount)}
          variant={index === 0 ? "secondary" : "outline"}
        >
          {formatGHS(amount)}
        </Button>
      ))}
      <Button
        aria-label="Backspace"
        className="h-11 text-lg"
        onClick={onBackspace}
        variant="outline"
      >
        ⌫
      </Button>
    </div>
  );
}
