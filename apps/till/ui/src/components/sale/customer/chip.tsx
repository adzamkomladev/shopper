import { Pencil, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { CustomerControls } from "../../../hooks/sale/customer/types";
import { displayName, initials, maskPhone } from "../../../sale/customers";

/**
 * Who the sale is for: the name an invoice carries, the number masked, and the TIN when there is one.
 * Edit (Alt+E) is offered only to a cashier who may write customers.
 */
export function CustomerChip({ controls }: { controls: CustomerControls }) {
  const { customer, locked } = controls;
  if (!customer) return null;
  const name = displayName(customer);
  const details = [
    customer.businessName ? customer.name : null,
    maskPhone(customer.phone),
    customer.tin ? `TIN ${customer.tin}` : null,
  ].filter(Boolean);
  return (
    <div
      aria-label="Customer"
      className="flex shrink-0 items-center gap-3 rounded-xl border bg-background py-2 pr-2 pl-3"
      role="group"
    >
      <Avatar>
        <AvatarFallback aria-hidden="true" className="text-kbd-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p>
      </div>
      {controls.canWrite && (
        <Button
          aria-keyshortcuts="Alt+E"
          aria-label="Edit customer"
          disabled={locked}
          onClick={controls.edit}
          size="touch"
          title="Edit customer (Alt+E)"
          variant="ghost"
        >
          <Pencil aria-hidden="true" />
          <Kbd className="hidden @md:inline-flex">Alt+E</Kbd>
        </Button>
      )}
      <Button
        aria-keyshortcuts="Alt+R"
        aria-label="Remove customer"
        disabled={locked}
        onClick={controls.remove}
        size="touch"
        title="Remove customer (Alt+R)"
        variant="ghost"
      >
        <X aria-hidden="true" />
        <Kbd className="hidden @md:inline-flex">Alt+R</Kbd>
      </Button>
    </div>
  );
}
