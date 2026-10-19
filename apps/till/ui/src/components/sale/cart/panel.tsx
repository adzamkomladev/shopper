import type { ReactNode } from "react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { usePriceOverride } from "../../../hooks/sale/price";
import type { ApproverState, Row, SaleTotals } from "../../../sale/types";
import { PriceDialog } from "../dialogs/price";
import { CartTotals } from "../totals";
import { CartControls } from "./controls";

type Props = {
  selected: Row | undefined;
  editing: boolean;
  /** Edits are paused: the host is away, a call is in flight or the basket failed. */
  disabled: boolean;
  canClear: boolean;
  canCheckout: boolean;
  saved: boolean;
  count: number;
  totals: SaleTotals | undefined;
  hidden: boolean;
  price: ReturnType<typeof usePriceOverride>;
  approvers: ApproverState;
  onReturnFocus: () => void;
  onQuantity: (thousandths: number) => void;
  onEditDone: () => void;
  onRemove: () => void;
  onClear: () => void;
  onCheckout: () => void;
  /** The basket lines, or the skeleton, empty or unavailable state in their place. */
  children: ReactNode;
};

/** Figma "Cart": the right panel until Checkout swaps it for the tender step. */
export function CartPanel({
  selected,
  editing,
  disabled,
  canClear,
  canCheckout,
  saved,
  count,
  totals,
  hidden,
  price,
  approvers,
  onReturnFocus,
  onQuantity,
  onEditDone,
  onRemove,
  onClear,
  onCheckout,
  children,
}: Props) {
  return (
    <section
      aria-label="Basket"
      className="@container flex min-h-152 min-w-0 flex-1 flex-col gap-4 rounded-panel border bg-card p-4 shadow-sm lg:min-h-0"
      hidden={hidden}
    >
      <CartControls
        canClear={canClear}
        disabled={disabled}
        editing={editing}
        onClear={onClear}
        onEditDone={onEditDone}
        onPrice={price.ask}
        priceBlocked={price.blocked}
        priceDisabled={price.disabled}
        onQuantity={onQuantity}
        onRemove={onRemove}
        row={selected}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      <CartTotals count={count} saved={saved} totals={totals} />
      <Button
        aria-keyshortcuts="Control+Enter"
        className="h-16 shrink-0 rounded-panel text-lg disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
        disabled={!canCheckout}
        onClick={onCheckout}
      >
        Checkout <Kbd className="pointer-coarse:inline-flex">Ctrl+Enter</Kbd>
      </Button>
      <PriceDialog approvers={approvers} onReturnFocus={onReturnFocus} price={price} />
    </section>
  );
}
