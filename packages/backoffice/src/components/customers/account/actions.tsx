import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { AccountPanels } from "../../../hooks/customers/types";
import type { CustomerView } from "../../../queries/customers/types";
import { CreditNoteDialog } from "./note";
import { LimitDialog } from "./limit";
import { PaymentDialog } from "./payment";
import { TransferDialog } from "./transfer";

const LIMIT_REASON_ID = "limit-reason";

/** Payment, credit note, limit and points transfer, each with its key. The limit says why it is off until identity is verified. */
export function AccountActions({
  panels,
  customer,
}: {
  panels: AccountPanels;
  customer: CustomerView;
}) {
  const verified = !!customer.kycVerifiedAt;
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Account actions" className="flex flex-wrap gap-2">
        <Button ref={panels.refs.pay} variant="outline" onClick={() => panels.pay.show()}>
          Record payment
          <Kbd aria-hidden>P</Kbd>
        </Button>
        <Button ref={panels.refs.note} variant="outline" onClick={() => panels.note.show()}>
          Credit note
          <Kbd aria-hidden>C</Kbd>
        </Button>
        <Button
          ref={panels.refs.limit}
          variant="outline"
          disabled={!verified}
          aria-describedby={verified ? undefined : LIMIT_REASON_ID}
          onClick={() => panels.limit.show()}
        >
          Set limit
          <Kbd aria-hidden>L</Kbd>
        </Button>
        <Button ref={panels.refs.transfer} variant="outline" onClick={() => panels.transfer.show()}>
          Transfer points
          <Kbd aria-hidden>T</Kbd>
        </Button>
      </div>
      {!verified && (
        <p id={LIMIT_REASON_ID} className="text-sm text-muted-foreground">
          A credit limit needs a customer whose identity has been verified.
        </p>
      )}
    </div>
  );
}

type DialogsProps = { panels: AccountPanels; customer: CustomerView };

export function AccountDialogs({ panels, customer }: DialogsProps) {
  return (
    <>
      <PaymentDialog
        customer={customer}
        open={panels.pay.open}
        onOpenChange={panels.pay.setOpen}
        restoreFocus={panels.pay.restoreFocus}
      />
      <CreditNoteDialog
        customer={customer}
        open={panels.note.open}
        onOpenChange={panels.note.setOpen}
        restoreFocus={panels.note.restoreFocus}
      />
      <LimitDialog
        customer={customer}
        open={panels.limit.open}
        onOpenChange={panels.limit.setOpen}
        restoreFocus={panels.limit.restoreFocus}
      />
      <TransferDialog
        customer={customer}
        open={panels.transfer.open}
        onOpenChange={panels.transfer.setOpen}
        restoreFocus={panels.transfer.restoreFocus}
      />
    </>
  );
}
