import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { initials } from "../../sale/customers";
import type { PurchaseSummary } from "../../sale/types";

/**
 * Figma "Customer" column: an initials avatar and the name, or "Walk-in customer" for a sale with none.
 * A row the register builds without a sale (a return, a payment still waiting) has nobody to name.
 */
export function PurchaseCustomer({ customer }: { customer: PurchaseSummary["customer"] }) {
  if (customer === undefined) return <span className="text-muted-foreground">—</span>;
  const name = customer?.name ?? "Walk-in customer";
  return (
    <span className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback aria-hidden="true" className="text-kbd-foreground">
          {customer ? initials(name) : "WC"}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}
