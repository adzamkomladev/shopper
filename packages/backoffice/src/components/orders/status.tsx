import { Badge } from "@shopper/ui/components/badge";
import type { OrderStatus } from "../../schemas/orders";

const LABELS: Record<OrderStatus, string> = {
  placed: "Awaiting payment",
  expired: "Lapsed",
  cancelled: "Cancelled",
  paid: "New",
  accepted: "Accepted",
  picking: "Picking",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  refunded: "Refunded",
};

/** An order's state in words, never colour alone. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === "paid") return <Badge>{LABELS.paid}</Badge>;
  if (status === "refunded" || status === "cancelled" || status === "expired")
    return <Badge variant="outline">{LABELS[status]}</Badge>;
  return <Badge variant="secondary">{LABELS[status]}</Badge>;
}
