import { useState } from "react";
import { X } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { cn } from "cn";
import { Input } from "@shopper/ui/components/input";
import { Money } from "@shopper/ui/components/money";
import { formatQuantity, parseQuantity } from "@shopper/utils";
import { isPriced, lineProblem } from "../../sale/rows";
import type { Row } from "../../sale/types";

export const QUANTITY_STEP = 1000;
// Scrolls a row into view when it becomes the selected one (a ref change calls this again).
export const reveal = (node: HTMLElement | null) => node?.scrollIntoView({ block: "nearest" });

type LineProps = {
  row: Row;
  /** Its place in the basket, shown in the badge. */
  position: number;
  selected: boolean;
  revealSelected: boolean;
  onSelect: () => void;
};

/** Figma "Order item": number, name with its detail, quantity and unit price, then the line amount. */
export function Line({ row, position, selected, revealSelected, onSelect }: LineProps) {
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
  const unitText = priced
    ? `${quantity === QUANTITY_STEP ? "" : `${formatQuantity(quantity)} × `}${formatGHS(row.tax.unitPrice)}`
    : "";
  return (
    <li
      aria-current={selected || undefined}
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 rounded-sm border px-2",
        priced ? "bg-primary/5" : "border-warning-border bg-warning text-warning-foreground",
        selected ? "border-primary" : priced && "border-transparent",
        selected &&
          "group-focus/lines:ring-2 group-focus/lines:ring-ring group-focus/lines:ring-inset",
      )}
      data-line={row.lineId}
      onClick={onSelect}
      ref={selected && revealSelected ? reveal : undefined}
    >
      <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-bold text-foreground">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-bold">{name}</p>
        <p className={cn("truncate text-xs", priced && "text-kbd-foreground")}>
          {detail}
          {priced && <span className="@md:hidden"> · {unitText}</span>}
        </p>
      </div>
      {priced ? (
        <>
          <span className="hidden shrink-0 items-center gap-0.5 text-xs font-medium text-kbd-foreground tabular-nums @md:flex">
            {quantity !== QUANTITY_STEP && <span>{formatQuantity(quantity)}</span>}
            {quantity !== QUANTITY_STEP && <X aria-hidden="true" className="size-3" />}
            <Money amount={row.tax.unitPrice} />
          </span>
          <Money
            amount={row.tax.gross}
            className={cn("w-24 shrink-0 text-sm", selected ? "font-bold" : "font-medium")}
          />
        </>
      ) : (
        <p className="shrink-0 text-sm font-medium">Not priced</p>
      )}
    </li>
  );
}

/** Replaces the quantity while F4 edits it: Enter applies, Escape (or leaving the field) cancels. */
export function QuantityField({
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
