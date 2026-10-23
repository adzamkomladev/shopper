import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { cn } from "cn";
import type { AccountPayment } from "../../hooks/accounts/types";
import { displayName, initials, spacedPhone } from "../../sale/customers";

const optionId = (index: number) => `payment-option-${index}`;

/** The number to look up, and everyone who uses it. ↑/↓ choose and Enter picks; a click does too. */
export function FindCustomer({ form }: { form: AccountPayment }) {
  const { customers, active, lookup, problem } = form;
  const listed = customers.length > 0;
  return (
    <div className="grid gap-4">
      <Field data-invalid={problem ? "true" : undefined}>
        <FieldLabel htmlFor="payment-phone">Customer phone</FieldLabel>
        <Input
          aria-activedescendant={listed ? optionId(active) : undefined}
          aria-controls={listed ? "payment-results" : undefined}
          aria-describedby={problem ? "payment-phone-error" : undefined}
          aria-expanded={listed}
          aria-invalid={problem ? true : undefined}
          autoComplete="off"
          autoFocus
          id="payment-phone"
          inputMode="tel"
          maxLength={20}
          onChange={form.onPhone}
          onKeyDown={form.onPhoneKeyDown}
          role="combobox"
          touch
          value={form.phone}
        />
        {problem && <FieldError id="payment-phone-error">{problem}</FieldError>}
      </Field>
      {lookup?.status === "loading" && <Skeleton className="h-16 rounded-xl" />}
      {lookup?.status === "ready" && !listed && (
        <p className="text-sm" role="status">
          <span className="font-medium">No customer uses this number.</span>{" "}
          <span className="text-muted-foreground">
            Add them from a sale with Add customer first.
          </span>
        </p>
      )}
      {listed && (
        <ul
          aria-label="Customers with this number"
          className="grid gap-2"
          id="payment-results"
          role="listbox"
        >
          {customers.map((customer, index) => (
            <li
              aria-selected={index === active}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2",
                index === active && "border-primary bg-primary/5",
              )}
              id={optionId(index)}
              key={customer.id}
              onClick={() => void form.choose(customer)}
              onPointerMove={() => index !== active && form.setActive(index)}
              role="option"
            >
              <Avatar>
                <AvatarFallback aria-hidden="true" className="text-kbd-foreground">
                  {initials(displayName(customer))}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{displayName(customer)}</span>
                <span className="block truncate text-xs text-kbd-foreground">
                  {spacedPhone(customer.phone)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
