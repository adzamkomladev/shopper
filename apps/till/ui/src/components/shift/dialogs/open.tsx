import { useState } from "react";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input/control";
import { useDialogSubmit } from "../../../hooks/shift/dialog/submit";
import { cedisText, countedTotal, parseCedis, parseCounts } from "../../../shift/amount";
import { nextOnEnter } from "../../../shift/keys";
import type { CountText, FloatInput } from "../../../shift/types";
import type { SaleOutcome } from "../../../sale/types";
import { CountGrid, CountTotal } from "../count/grid";
import { DialogFrame } from "./frame";

/** Mounted with the dialog content, so closing the dialog drops what was typed. */
export function OpenForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (input: FloatInput) => Promise<SaleOutcome>;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"count" | "amount">("count");
  const [counts, setCounts] = useState<CountText>({});
  const [amount, setAmount] = useState("");
  const float = parseCedis(amount);
  // An empty grid is not a float; a float of nothing is entered as the amount 0.
  const ready = mode === "count" ? countedTotal(counts) > 0 : float !== null;
  const form = useDialogSubmit(
    ready,
    () => onSubmit(mode === "count" ? { counts: parseCounts(counts) } : { float: float! }),
    onDone,
  );
  return (
    <form
      className="grid gap-4"
      noValidate
      onKeyDown={nextOnEnter}
      onSubmit={form.onSubmit}
      ref={form.shortcuts}
    >
      <DialogFrame
        action="Open shift"
        block={
          ready
            ? null
            : mode === "count"
              ? "Count at least one note or coin, or enter 0 as an amount"
              : "Enter the float in cedis, like 200 or 150.50"
        }
        description="Count the notes and coins in the drawer, or enter the float as one amount."
        onCancel={onDone}
        pending={form.pending}
        problem={form.problem}
        summary={mode === "count" ? <CountTotal values={counts} /> : undefined}
        title="Open shift"
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["count", "Count notes and coins"],
              ["amount", "Enter an amount"],
            ] as const
          ).map(([value, label]) => (
            <Button
              aria-pressed={mode === value}
              key={value}
              onClick={() => setMode(value)}
              size="touch"
              type="button"
              variant={mode === value ? "default" : "outline"}
            >
              {label}
            </Button>
          ))}
        </div>
        {mode === "count" ? (
          <CountGrid
            onChange={(face, text) => setCounts((now) => ({ ...now, [face]: text }))}
            values={counts}
          />
        ) : (
          <Field>
            <FieldLabel htmlFor="shift-float">Float amount (GH₵)</FieldLabel>
            <Input
              autoComplete="off"
              autoFocus
              id="shift-float"
              inputMode="decimal"
              onChange={(event) => setAmount(cedisText(event.target.value))}
              touch
              value={amount}
            />
          </Field>
        )}
      </DialogFrame>
    </form>
  );
}
