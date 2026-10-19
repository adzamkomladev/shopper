import { useState, type FormEvent } from "react";
import { formatGHS, fromDecimal, money, toDecimal, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { useApprovalForm } from "../../../hooks/approval/form";
import type { usePriceOverride } from "../../../hooks/sale/price";
import type { ApproverState, PricedRow } from "../../../sale/types";
import { ApprovalFields } from "../../approval/fields";

type PriceOverride = ReturnType<typeof usePriceOverride>;

/** Overrides one line's unit price for this sale, with a reason and a manager's PIN unless the cashier holds the permission. */
export function PriceDialog({
  price,
  approvers,
  onReturnFocus,
}: {
  price: PriceOverride;
  approvers: ApproverState;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={price.open} onOpenChange={price.setOpen}>
      <DialogContent
        aria-describedby="price-override-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        showCloseButton={false}
      >
        {price.row && (
          <PriceForm approvers={approvers} key={price.row.lineId} price={price} row={price.row} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog content, so closing the dialog drops the price, reason and PIN. */
function PriceForm({
  row,
  price,
  approvers,
}: {
  row: PricedRow;
  price: PriceOverride;
  approvers: ApproverState;
}) {
  const listed = money(row.listPrice ?? row.tax.unitPrice);
  const [text, setText] = useState(decimal(row.tax.unitPrice));
  const [reason, setReason] = useState("");
  const manager = useApprovalForm(approvers, price.approval);
  const unitPrice = parsePrice(text);
  const same = unitPrice === listed;
  const why = reason.trim();
  const valid = unitPrice !== null && !same && why !== "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid)
      void manager.submit((approval) =>
        price.submit({ unitPrice, reason: why, ...(approval ? { approval } : {}) }),
      );
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Override price</DialogTitle>
        <DialogDescription id="price-override-help">
          {row.name}. The new price applies to this sale only.
          {price.approval && " A manager must approve a price change."}
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={text !== "" && unitPrice === null ? "true" : undefined}>
        <FieldLabel htmlFor="price-unit">New unit price</FieldLabel>
        <Input
          aria-describedby="price-unit-help"
          aria-invalid={text !== "" && unitPrice === null ? true : undefined}
          autoFocus
          id="price-unit"
          inputMode="decimal"
          onChange={(event) => setText(event.target.value.replace(/[^\d.]/g, "").slice(0, 12))}
          onFocus={(event) => event.currentTarget.select()}
          touch
          value={text}
        />
        <FieldDescription id="price-unit-help">
          {`List price ${formatGHS(listed)}.${same ? " Enter a different price." : ""}`}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="price-reason">Reason</FieldLabel>
        <Input
          id="price-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          touch
          value={reason}
        />
      </Field>
      {price.approval && (
        <ApprovalFields
          approvers={approvers}
          form={manager}
          onRetry={price.retryApprovers}
          permission="sale.price_override"
        />
      )}
      {manager.problem && <FieldError>{manager.problem}</FieldError>}
      <DialogFooter>
        <Button disabled={!valid || !manager.ready || manager.pending} size="touch" type="submit">
          Set price{unitPrice !== null && !same && ` to ${formatGHS(unitPrice)}`}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Whole pesewas as 4.50; a finer per-kg price keeps its fourth place. */
function decimal(amount: Money) {
  const text = toDecimal(amount, 4);
  return text.endsWith("00") ? text.slice(0, -2) : text;
}

function parsePrice(text: string): Money | null {
  try {
    return fromDecimal(text.trim());
  } catch {
    return null;
  }
}
