import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input/control";
import { formatGHS, toDecimal, type Money } from "@shopper/money";
import { QuickCash } from "./quick";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "C"] as const;

export function TenderKeypad({
  balance,
  value,
  pad = true,
  onChange,
  onEnter,
}: {
  balance: Money;
  value: string;
  /** False leaves the amount box alone: the till-size panel has no room for the pad beside an account summary. */
  pad?: boolean;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  function press(key: (typeof keys)[number]) {
    if (key === "C") return onChange("0.00");
    const digits = value.replace(".", "");
    const next = `${digits}${key}`;
    const padded = next.padStart(3, "0");
    onChange(`${padded.slice(0, -2)}.${padded.slice(-2)}`);
  }
  function backspace() {
    const digits = value.replace(".", "").slice(0, -1) || "0";
    const padded = digits.padStart(3, "0");
    onChange(`${padded.slice(0, -2)}.${padded.slice(-2)}`);
  }
  return (
    <>
      <label className="grid shrink-0 gap-1.5 text-sm font-medium">
        Amount tendered
        <Input
          aria-label="Amount tendered"
          className="h-11"
          inputMode="decimal"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onEnter();
            }
          }}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, "").slice(0, 12))}
        />
      </label>
      {pad && (
        <div className="grid shrink-0 grid-cols-5 gap-3">
          <div aria-label="Amount keypad" className="col-span-3 grid grid-cols-3 gap-2">
            {keys.map((key) => (
              <Button
                key={key}
                aria-label={key}
                className="h-11 text-lg"
                onClick={() => press(key)}
                variant="outline"
              >
                {key}
              </Button>
            ))}
          </div>
          <QuickCash
            balance={balance}
            onBackspace={backspace}
            onSelect={(amount) => onChange(toDecimal(amount))}
          />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        Tender balance {formatGHS(balance)}
      </span>
    </>
  );
}
