import type { Dispatch, SetStateAction } from "react";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input/control";
import { formatGHS, toDecimal, type Money } from "@shopper/money";
import type { AmountEntry } from "../../../sale/account/types";
import { QuickCash } from "./quick";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "C"] as const;

/** The amount box. A typed digit repaints this alone (tests/e2e/till/ui/tender/latency.spec.ts). */
export function AmountField({
  balance,
  value,
  onChange,
  onEnter,
}: {
  balance: Money;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
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
      <span className="sr-only" aria-live="polite">
        Tender balance {formatGHS(balance)}
      </span>
    </>
  );
}

/**
 * The digit pad and quick cash. Its keys edit whatever the amount is when they land and never read it, and
 * every prop is stable while the cashier types, so a typed digit does not repaint them.
 */
export function TenderPad({
  balance,
  draftKey,
  fallback,
  setEntry,
  onEdit,
}: {
  balance: Money;
  draftKey: string | null;
  /** What the box shows before anything is typed. */
  fallback: string;
  setEntry: Dispatch<SetStateAction<AmountEntry | null>>;
  /** Runs before each edit. */
  onEdit: () => void;
}) {
  const edit = (change: (value: string) => string) => {
    onEdit();
    if (draftKey)
      setEntry((current) => ({
        draftKey,
        value: change(current?.draftKey === draftKey ? current.value : fallback),
      }));
  };
  const press = (key: (typeof keys)[number]) =>
    edit((value) => (key === "C" ? "0.00" : cents(`${value.replace(".", "")}${key}`)));
  return (
    <div className="grid shrink-0 grid-cols-5 gap-3">
      <div aria-label="Amount keypad" className="col-span-3 grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            aria-label={key}
            className="h-11 text-base"
            onClick={() => press(key)}
            variant="outline"
          >
            {key}
          </Button>
        ))}
      </div>
      <QuickCash
        balance={balance}
        onBackspace={() => edit((value) => cents(value.replace(".", "").slice(0, -1) || "0"))}
        onSelect={(amount) => edit(() => toDecimal(amount))}
      />
    </div>
  );
}

/** Typed digits as cedis and pesewas: "250" is "2.50". */
function cents(digits: string) {
  const padded = digits.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}
