import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import { Money } from "@shopper/ui/components/money";
import { formatQuantity, parseQuantity } from "../../sale/quantity";
import { isPriced, lineProblem } from "../../sale/rows";
import type { Row } from "../../sale/types";

export const QUANTITY_STEP = 1000;
// Scrolls a row into view when it becomes the selected one (a ref change calls this again).
export const reveal = (node: HTMLElement | null) => node?.scrollIntoView({ block: "nearest" });

type LineProps = {
  row: Row;
  selected: boolean;
  editing: boolean;
  disabled: boolean;
  onSelect: () => void;
  onQuantity: (thousandths: number) => void;
  onEditDone: () => void;
  onRemove: () => void;
};

export function Line({
  row,
  selected,
  editing,
  disabled,
  onSelect,
  onQuantity,
  onEditDone,
  onRemove,
}: LineProps) {
  const { quantityThousandths: quantity, label } = row.line;
  const priced = isPriced(row);
  const name = priced ? row.name : "Unavailable product";
  const detail = priced
    ? [
        row.sku,
        row.baseUnit !== "each" ? `per ${row.baseUnit}` : null,
        label ? `${label.kind} label` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : lineProblem(row.error);
  return (
    <li
      aria-current={selected || undefined}
      className={cn(
        "flex h-16 items-center gap-3 border-b border-l-4 px-4",
        priced
          ? "border-l-transparent"
          : "border-l-warning-border bg-warning text-warning-foreground",
        selected && priced && "border-l-primary bg-primary/5",
        selected &&
          "group-focus/lines:ring-2 group-focus/lines:ring-inset group-focus/lines:ring-ring",
      )}
      data-line={row.lineId}
      onClick={onSelect}
      ref={selected ? reveal : undefined}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-none font-medium">{name}</p>
        <p
          className={cn(
            "mt-1 truncate text-xs",
            priced && (selected ? "text-primary" : "text-muted-foreground"),
          )}
        >
          {detail}
        </p>
      </div>
      <div className="flex w-36 items-center justify-between gap-1">
        {priced && (
          <>
            <Button
              aria-label={`Decrease quantity of ${name}`}
              disabled={disabled || quantity <= QUANTITY_STEP}
              onClick={() => onQuantity(quantity - QUANTITY_STEP)}
              size="icon-touch"
              variant="outline"
            >
              <Minus aria-hidden="true" />
            </Button>
            {editing ? (
              <QuantityField
                name={name}
                quantity={quantity}
                onCommit={onQuantity}
                onCancel={onEditDone}
              />
            ) : (
              <span className="min-w-6 text-center text-base font-medium tabular-nums">
                {formatQuantity(quantity)}
              </span>
            )}
            <Button
              aria-label={`Increase quantity of ${name}`}
              disabled={disabled}
              onClick={() => onQuantity(quantity + QUANTITY_STEP)}
              size="icon-touch"
              variant="outline"
            >
              <Plus aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
      {priced ? (
        <>
          <Money
            amount={row.tax.unitPrice}
            // On the tinted selected row muted text drops below 4.5:1; slate-600 keeps AA.
            className={cn(
              "w-24 text-sm font-medium",
              selected ? "text-kbd-foreground" : "text-muted-foreground",
            )}
          />
          <Money amount={row.tax.gross} className="w-28 text-base font-bold" />
        </>
      ) : (
        <p className="w-55 text-right text-sm font-medium">Not priced</p>
      )}
      <Button
        aria-label={`Remove ${name}`}
        className="text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
        size="icon-touch"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}

/** Replaces the quantity while F4 edits it: Enter applies, Escape (or leaving the field) cancels. */
function QuantityField({
  name,
  quantity,
  onCommit,
  onCancel,
}: {
  name: string;
  quantity: number;
  onCommit: (thousandths: number) => void;
  onCancel: () => void;
}) {
  const [invalid, setInvalid] = useState(false);
  return (
    <Input
      aria-invalid={invalid}
      aria-label={`Quantity of ${name}`}
      autoFocus
      className="w-16 px-1 text-center tabular-nums"
      defaultValue={formatQuantity(quantity)}
      inputMode="decimal"
      onBlur={onCancel}
      onChange={() => setInvalid(false)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const next = parseQuantity(event.currentTarget.value);
        if (next === null) setInvalid(true);
        else onCommit(next);
      }}
      touch
    />
  );
}
