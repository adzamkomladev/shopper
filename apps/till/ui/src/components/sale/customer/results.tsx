import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Badge } from "@shopper/ui/components/badge";
import { cn } from "cn";
import type { CustomerForm } from "../../../hooks/sale/customer/types";
import { displayName, initials, spacedPhone } from "../../../sale/customers";

export const resultsId = "customer-results";
export const optionId = (index: number) => `customer-option-${index}`;

/** Everyone who uses the number just looked up. ↑/↓ choose, Enter adds; a click does too. */
export function CustomerResults({ form }: { form: CustomerForm }) {
  const { customers, active } = form;
  return (
    <div className="grid gap-2">
      {customers.length > 1 && (
        <p className="text-sm font-medium" id="customer-duplicates">
          {customers.length} customers use this number
        </p>
      )}
      <ul
        aria-describedby={customers.length > 1 ? "customer-duplicates" : undefined}
        aria-label="Customers with this number"
        className="grid gap-2"
        id={resultsId}
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
            onClick={() => form.choose(customer)}
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
              <span
                className={cn(
                  "block truncate text-xs",
                  // Muted text on the tinted active row drops below 4.5:1; slate-600 keeps AA.
                  index === active ? "text-kbd-foreground" : "text-muted-foreground",
                )}
              >
                {[
                  customer.businessName ? customer.name : null,
                  spacedPhone(customer.phone),
                  customer.tin ? `TIN ${customer.tin}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {customer.pending && <Badge variant="secondary">Not uploaded yet</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}
