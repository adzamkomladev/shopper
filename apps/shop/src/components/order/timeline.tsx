import { Check } from "lucide-react";
import type { PlacedOrder } from "../../schemas/checkout";

const clock = new Intl.DateTimeFormat("en-GH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

/** Where the order is on its way to the shopper: each step with the time it was reached. */
export function OrderTimeline({ order }: { order: PlacedOrder }) {
  const at = (status: string) => order.timeline.find((event) => event.status === status)?.at;
  const delivery = order.fulfilment === "delivery";
  const steps = [
    { status: "paid", label: "Paid" },
    { status: "accepted", label: "Accepted by the shop" },
    { status: "picking", label: "Being picked" },
    delivery
      ? { status: "out_for_delivery", label: "Out for delivery" }
      : { status: "ready", label: "Ready for pickup" },
    { status: "completed", label: delivery ? "Delivered" : "Collected" },
  ];
  const reached = steps.filter(
    (step) => at(step.status) || (step.status === "ready" && at("out_for_delivery")),
  );
  const current = reached.at(-1)?.status;
  return (
    <section aria-labelledby="order-progress" className="rounded-panel border bg-card p-5">
      <h2 id="order-progress" className="mb-4 text-lg font-bold">
        Progress
      </h2>
      <ol className="space-y-4">
        {steps.map((step) => {
          const time = at(step.status);
          const done = Boolean(time);
          return (
            <li
              key={step.status}
              aria-current={step.status === current ? "step" : undefined}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-3.5" /> : null}
              </span>
              <span className={done ? "font-semibold" : "text-muted-foreground"}>{step.label}</span>
              {time ? (
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                  {clock.format(new Date(time))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
