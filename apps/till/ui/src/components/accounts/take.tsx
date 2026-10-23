import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { formatGHS, money } from "@shopper/money";
import type { AccountPayment, Owed } from "../../hooks/accounts/types";
import { depositOf, owedOf } from "../../sale/account/rules";
import type { CustomerRecord } from "../../sale/customer/types";
import { displayName, initials, spacedPhone } from "../../sale/customers";

/** Who is paying, what they owe, the amount and how it was paid. */
export function TakePayment({
  form,
  customer,
}: {
  form: AccountPayment;
  customer: CustomerRecord;
}) {
  const momo = form.method === "momo";
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-xl border bg-card py-2 pr-2 pl-3">
        <Avatar>
          <AvatarFallback aria-hidden="true" className="text-kbd-foreground">
            {initials(displayName(customer))}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{displayName(customer)}</p>
          <p className="truncate text-xs text-muted-foreground">{spacedPhone(customer.phone)}</p>
        </div>
        <Button onClick={form.change} size="touch" type="button" variant="ghost">
          Change
        </Button>
      </div>
      <OwedRow owed={form.owed} />
      <Field>
        <FieldLabel htmlFor="payment-amount">Amount (GH₵)</FieldLabel>
        <Input
          autoComplete="off"
          autoFocus
          id="payment-amount"
          inputMode="decimal"
          onChange={form.onAmount}
          touch
          value={form.amount}
        />
      </Field>
      <div aria-label="Paid with" className="grid grid-cols-2 gap-2" role="group">
        {(["cash", "momo"] as const).map((method) => (
          <Button
            aria-describedby={method === "momo" && !form.online ? "payment-momo-reason" : undefined}
            aria-pressed={form.method === method}
            disabled={method === "momo" && !form.online}
            key={method}
            onClick={() => form.setMethod(method)}
            size="touch"
            type="button"
            variant={form.method === method ? "default" : "outline"}
          >
            {method === "cash" ? "Cash" : "MoMo"}
          </Button>
        ))}
      </div>
      {!form.online && (
        <p className="text-sm text-muted-foreground" id="payment-momo-reason">
          Needs a connection
        </p>
      )}
      {momo && (
        <Field>
          <FieldLabel htmlFor="payment-reference">MoMo reference</FieldLabel>
          <Input
            autoComplete="off"
            id="payment-reference"
            maxLength={100}
            onChange={(event) => form.setReference(event.target.value)}
            touch
            value={form.reference}
          />
        </Field>
      )}
    </div>
  );
}

const row = "flex min-h-14 items-center justify-between gap-3 rounded-md border px-3";

function OwedRow({ owed }: { owed: Owed }) {
  if (owed.status === "loading")
    return <Skeleton aria-label="Loading balance" className="h-14" role="status" />;
  if (owed.status !== "ready")
    return (
      <p className={`${row} text-sm text-muted-foreground`}>
        {owed.status === "offline" ? "Balance needs a connection" : "The balance could not be read"}
      </p>
    );
  const deposit = owed.account.balance < 0;
  return (
    <p className={row}>
      <span className="text-sm text-muted-foreground">{deposit ? "Deposit" : "Owed"}</span>
      <span className="font-semibold tabular-nums">
        {formatGHS(money(deposit ? depositOf(owed.account) : owedOf(owed.account)))}
      </span>
    </p>
  );
}
