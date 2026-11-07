import { MapPinIcon, PhoneIcon, TruckIcon } from "lucide-react";
import type { StaffOrder } from "../../../schemas/orders";
import { slotLabel, untilSlot } from "../format";
import { OrderStatusBadge } from "../status";

/** Who the order is for, when, and how it leaves the shop. */
export function OrderHeader({ order }: { order: StaffOrder }) {
  const address =
    order.deliveryAddress && Object.values(order.deliveryAddress).filter(Boolean).join(", ");
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          Order #{order.number}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Customer</dt>
          <dd className="font-medium text-foreground">{order.customer.name}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <PhoneIcon aria-hidden className="size-3.5" />
          <dt className="sr-only">Phone</dt>
          <dd>{order.customer.phone}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          {order.fulfilment === "pickup" ? (
            <MapPinIcon aria-hidden className="size-3.5" />
          ) : (
            <TruckIcon aria-hidden className="size-3.5" />
          )}
          <dt className="sr-only">Handover</dt>
          <dd>
            {order.fulfilment === "pickup"
              ? `Pickup at ${order.branch.name}`
              : `Delivery to ${address}`}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Slot</dt>
          <dd>
            {slotLabel(order.slotStart, order.slotEnd)} ({untilSlot(order.slotStart)})
          </dd>
        </div>
      </dl>
    </header>
  );
}
