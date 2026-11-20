import { TagIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Money } from "@shopper/ui/components/money";
import type { StaffOrder } from "../../../schemas/orders";

const TITLE = "Prices changed since this order was paid";

/**
 * A relayed order (v1.5 Day 50) keeps the price its customer paid online; these are the lines the shop now prices
 * differently, so nobody at the counter charges the new price.
 */
export function PriceCheckNote({ lines }: { lines: NonNullable<StaffOrder["priceCheck"]> }) {
  return (
    <Alert role="note" aria-label={TITLE}>
      <TagIcon aria-hidden />
      <AlertTitle>{TITLE}</AlertTitle>
      <AlertDescription>
        <p>Charge what the customer paid.</p>
        <ul className="flex w-full flex-col gap-1">
          {lines.map((line) => (
            <li key={line.lineId} className="flex flex-wrap justify-between gap-x-4">
              <span className="font-medium text-foreground">{line.name}</span>
              <span className="flex flex-wrap gap-x-1">
                Paid <Money amount={money(line.paid)} className="inline" /> · now{" "}
                {line.now === null ? (
                  "not on sale"
                ) : (
                  <Money amount={money(line.now)} className="inline" />
                )}
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
