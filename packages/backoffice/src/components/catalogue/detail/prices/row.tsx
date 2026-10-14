import { money } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import { formatDate, formatDateTime } from "../../../../lib/catalogue/detail/prices/groups";
import type { PriceView } from "../../../../queries/catalogue/detail";

type Props = { price: PriceView; scope: string };

/** One price version: where it applies, when and why on the left, the amount on the right. */
export function PriceRow({ price, scope }: Props) {
  return (
    <li className="flex items-start gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{scope}</span>
        <span className="text-sm text-muted-foreground">{period(price)}</span>
        {price.reason && (
          <span className="text-sm wrap-break-word text-muted-foreground">{price.reason}</span>
        )}
      </div>
      <Money amount={money(price.amount)} />
    </li>
  );
}

function period({ validFrom, validTo }: PriceView) {
  return validTo
    ? `${formatDateTime(validFrom)} to ${formatDateTime(validTo)}`
    : `From ${formatDate(validFrom)}`;
}
