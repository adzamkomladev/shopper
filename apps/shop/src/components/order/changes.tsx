import { PackageX, Repeat } from "lucide-react";
import { formatGHS } from "@shopper/money";
import type { PlacedOrder } from "../../schemas/checkout";
import { quantityLabel } from "../cart/quantity";

/** What the shop changed while picking: items it was short of, what stood in for them, and the money that came back. */
export function OrderChanges({ order }: { order: PlacedOrder }) {
  if (!order.adjustment) return null;
  const changed = order.lines.filter((line) => line.pick && line.pick.outcome !== "picked");
  return (
    <section
      aria-labelledby="order-changes"
      className="rounded-panel border border-primary/30 bg-card p-5"
    >
      <h2 id="order-changes" className="text-lg font-bold">
        Your order changed
      </h2>
      <p className="mt-1 text-muted-foreground">
        The shop could not fill all of it.{" "}
        {order.adjustment.refundAmount > 0
          ? `You pay ${formatGHS(order.adjustment.afterGross)} instead of ${formatGHS(order.adjustment.beforeGross)}, and ${formatGHS(order.adjustment.refundAmount)} is on its way back to you.`
          : `You still pay ${formatGHS(order.adjustment.afterGross)}, no more than before.`}
      </p>
      <ul className="mt-3 space-y-3">
        {changed.map((line) => (
          <li key={line.productId} className="flex items-start gap-3">
            {line.pick!.substitute ? (
              <Repeat aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <PackageX aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-semibold">
                {line.name}: you get {quantityLabel(line.pick!.pickedThousandths, line.baseUnit)} of{" "}
                {quantityLabel(line.quantityThousandths, line.baseUnit)}
              </span>
              {line.pick!.substitute ? (
                <span className="block text-muted-foreground">
                  In its place: {quantityLabel(line.pick!.substitute.quantityThousandths, "each")} ×{" "}
                  {line.pick!.substitute.name} ({formatGHS(line.pick!.substitute.gross)})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
