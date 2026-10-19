import { Minus, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { formatQuantity } from "@shopper/utils";
import { isPriced } from "../../../sale/rows";
import type { Row } from "../../../sale/types";
import { QUANTITY_STEP, QuantityField } from "../line";

type Props = {
  /** The line the buttons act on: the selected one, else the newest. */
  row: Row | undefined;
  editing: boolean;
  disabled: boolean;
  canClear: boolean;
  /** Why the price cannot be overridden on this line, when it is the line and not the sale that blocks it. */
  priceBlocked: string | null;
  priceDisabled: boolean;
  onPrice: () => void;
  onQuantity: (thousandths: number) => void;
  onEditDone: () => void;
  onRemove: () => void;
  onClear: () => void;
};

/** Figma "Clear cart" and "Quantity controls": the whole basket, then the selected line. */
export function CartControls({
  row,
  editing,
  disabled,
  canClear,
  priceBlocked,
  priceDisabled,
  onPrice,
  onQuantity,
  onEditDone,
  onRemove,
  onClear,
}: Props) {
  const priced = row !== undefined && isPriced(row);
  const quantity = row?.line.quantityThousandths ?? 0;
  const name = row === undefined ? "line" : priced ? row.name : "Unavailable product";
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-2">
      <Button
        aria-keyshortcuts="F11"
        aria-label="Clear cart"
        className="h-14 min-w-36 flex-1 rounded-xl text-base text-destructive hover:text-destructive sm:max-w-48"
        disabled={!canClear}
        onClick={onClear}
        variant="outline"
      >
        Clear cart <Kbd className="pointer-coarse:inline-flex">F11</Kbd>
      </Button>
      <div className="flex items-center gap-2">
        <Button
          aria-label={`Decrease quantity of ${name}`}
          className="rounded-full"
          disabled={disabled || !priced || quantity <= QUANTITY_STEP}
          onClick={() => onQuantity(quantity - QUANTITY_STEP)}
          size="icon-touch"
          variant="secondary"
        >
          <Minus aria-hidden="true" />
        </Button>
        {editing && priced ? (
          <QuantityField
            name={name}
            quantity={quantity}
            onCommit={onQuantity}
            onCancel={onEditDone}
          />
        ) : (
          <span className="grid h-11 min-w-12 place-items-center rounded-sm border border-primary bg-primary/5 px-2 text-xl font-medium tabular-nums">
            {priced ? formatQuantity(quantity) : "-"}
          </span>
        )}
        <Button
          aria-label={`Increase quantity of ${name}`}
          className="rounded-full"
          disabled={disabled || !priced}
          onClick={() => onQuantity(quantity + QUANTITY_STEP)}
          size="icon-touch"
          variant="secondary"
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          aria-describedby={priceBlocked ? "price-blocked" : undefined}
          aria-keyshortcuts="Alt+O"
          aria-label="Override price"
          disabled={priceDisabled}
          onClick={onPrice}
          size="touch"
          title="Override price"
          variant="outline"
        >
          <Tag aria-hidden="true" /> <span className="hidden @xl:inline">Price</span>{" "}
          <Kbd className="pointer-coarse:inline-flex">Alt+O</Kbd>
        </Button>
        <Button
          aria-label={`Remove ${name}`}
          className="text-destructive hover:text-destructive"
          disabled={disabled || row === undefined}
          onClick={onRemove}
          size="icon-touch"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {priceBlocked && (
        <p className="w-full text-xs text-muted-foreground" id="price-blocked" role="status">
          {priceBlocked}
        </p>
      )}
    </div>
  );
}
