import { Clock, MapPin, PackageCheck, Truck } from "lucide-react";
import { formatGHS } from "@shopper/money";
import type { PlacedOrder } from "../../schemas/checkout";
import { quantityLabel } from "../cart/quantity";
import { dayLabel, slotLabel } from "../checkout/slots";
import { CartTotals } from "../cart/totals";
import { CancelOrder } from "./cancel";
import { OrderChanges } from "./changes";
import { PayPanel } from "./pay";
import { ReviewPanel } from "./review";
import { OrderTimeline } from "./timeline";

const clock = new Intl.DateTimeFormat("en-GH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

const statusCopy: Record<
  PlacedOrder["status"],
  (order: PlacedOrder) => { title: string; detail: string }
> = {
  placed: (order) => ({
    title: "Awaiting payment",
    detail: `Pay before ${clock.format(new Date(order.holdExpiresAt))} to keep your items.`,
  }),
  expired: () => ({
    title: "This order lapsed",
    detail: "It was not paid in time, so the items went back on the shelf.",
  }),
  cancelled: () => ({ title: "Cancelled", detail: "This order was cancelled." }),
  paid: (order) => ({
    title: "Paid",
    detail: `The shop has your payment and will get your order ready.${order.receiptNumber ? ` Receipt ${order.receiptNumber}.` : ""}`,
  }),
  refunded: () => ({
    title: "Refunded",
    detail: "The shop could not fill this order. Your payment is on its way back to you.",
  }),
  accepted: () => ({ title: "Being prepared", detail: "The shop is getting your order ready." }),
  picking: () => ({
    title: "Being picked",
    detail: "Someone at the shop is gathering your items.",
  }),
  ready: (order) =>
    order.fulfilment === "pickup"
      ? { title: "Ready for pickup", detail: `Collect it at ${order.branch.name}.` }
      : { title: "Packed", detail: "Your order is packed and waiting for the rider." },
  out_for_delivery: () => ({ title: "On its way", detail: "Your order is out for delivery." }),
  completed: (order) => ({
    title: order.fulfilment === "pickup" ? "Collected" : "Delivered",
    detail: "Enjoy your order. Thank you for shopping with us.",
  }),
};

/** The order the shopper just placed: its number, where and when, what is in it, and what happens next. */
export function OrderConfirmation({
  order,
  shop,
  orderKey,
}: {
  order: PlacedOrder;
  shop: string;
  orderKey: string;
}) {
  const status = statusCopy[order.status](order);
  const products = order.lines.filter((line) => line.kind === "product");
  const delivery = order.lines.find((line) => line.kind === "delivery");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-6">
        <section
          aria-labelledby="order-status"
          className="flex gap-4 rounded-panel border border-primary/30 bg-shop-glow p-5 text-shop-ink"
        >
          <PackageCheck aria-hidden className="size-8 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Order {order.number}</p>
            <h2 id="order-status" className="text-2xl font-black">
              {status.title}
            </h2>
            <p className="mt-1 text-pretty">{status.detail}</p>
          </div>
        </section>
        {order.status === "placed" ? (
          <>
            <PayPanel shop={shop} order={order} orderKey={orderKey} />
            <CancelOrder shop={shop} order={order} orderKey={orderKey} />
          </>
        ) : null}
        {order.timeline.some((event) => event.status === "paid") && order.status !== "refunded" ? (
          <OrderTimeline order={order} />
        ) : null}
        <OrderChanges order={order} />
        {order.status === "completed" ? (
          <ReviewPanel shop={shop} order={order} orderKey={orderKey} />
        ) : null}
        <section
          aria-labelledby="order-when"
          className="grid gap-4 rounded-panel border bg-card p-5 sm:grid-cols-2"
        >
          <h2 id="order-when" className="sr-only">
            Where and when
          </h2>
          <p className="flex items-start gap-3">
            {order.fulfilment === "pickup" ? (
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-semibold">
                {order.fulfilment === "pickup" ? `Pick up at ${order.branch.name}` : "Delivery"}
              </span>
              <span className="block text-muted-foreground">
                {order.deliveryAddress
                  ? [
                      order.deliveryAddress.line1,
                      order.deliveryAddress.area,
                      order.deliveryAddress.city,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : `For ${order.customerName}`}
              </span>
            </span>
          </p>
          <p className="flex items-start gap-3">
            <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">{dayLabel(order.slotStart)}</span>
              <span className="block text-muted-foreground tabular-nums">
                {slotLabel(order.slotStart, order.slotEnd)}
              </span>
            </span>
          </p>
        </section>
        <section aria-labelledby="order-items" className="rounded-panel border bg-card">
          <h2 id="order-items" className="border-b px-5 py-3 text-lg font-bold">
            Items
          </h2>
          <ol className="divide-y">
            {products.map((line, index) => (
              <li key={line.productId} className="flex items-baseline gap-3 px-5 py-3">
                <span
                  aria-hidden
                  className="w-5 text-sm font-bold text-muted-foreground tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{line.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    × {quantityLabel(line.quantityThousandths, line.baseUnit)}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{formatGHS(line.gross)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <CartTotals
        quote={{
          totals: order.totals,
          count: products.length,
          delivery: delivery ? { gross: delivery.gross } : null,
        }}
        pricing={false}
      />
    </div>
  );
}
