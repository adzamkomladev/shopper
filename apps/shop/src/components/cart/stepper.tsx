import type { Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { quantityLabel } from "./quantity";

/** Minus, the quantity and plus, the Web Flow cart's stepper. Minus at the smallest step offers removal instead. */
export function QuantityStepper({
  name,
  quantityThousandths,
  baseUnit,
  step,
  max,
  onChange,
  className = "",
  moreRef,
}: {
  name: string;
  quantityThousandths: number;
  baseUnit: string;
  step: number;
  max?: number;
  onChange: (quantityThousandths: number) => void;
  className?: string;
  moreRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div
      role="group"
      aria-label={`Quantity of ${name}`}
      className={`flex items-center gap-1 rounded-full border bg-card p-1 ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-full"
        aria-label={`One less ${name}`}
        onClick={() => onChange(quantityThousandths - step)}
      >
        <Minus aria-hidden />
      </Button>
      <output aria-live="polite" className="min-w-14 text-center font-bold tabular-nums">
        {quantityLabel(quantityThousandths, baseUnit)}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 rounded-full"
        ref={moreRef}
        aria-label={`One more ${name}`}
        disabled={max !== undefined && quantityThousandths + step > max}
        onClick={() => onChange(quantityThousandths + step)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
