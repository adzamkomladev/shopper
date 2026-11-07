import { CheckIcon, MinusIcon, RepeatIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Money } from "@shopper/ui/components/money";
import type { OrderLine } from "../../../schemas/orders";
import { quantityText } from "../format";

/** One item on the pick list: what is wanted, what was found, and the buttons to say so while picking. */
export function PickLine({
  line,
  picking,
  busy,
  onFoundAll,
  onShort,
}: {
  line: OrderLine;
  picking: boolean;
  busy: boolean;
  onFoundAll: () => void;
  onShort: () => void;
}) {
  const pick = line.pick;
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{line.name}</span>
        <span className="text-sm text-muted-foreground">
          {line.kind === "delivery" ? (
            "Delivery fee"
          ) : (
            <>
              {quantityText(line.quantityThousandths, line.unit)} ·{" "}
              <Money amount={money(line.gross)} className="inline" />
            </>
          )}
        </span>
        {pick && (
          <span className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            {pick.outcome === "picked" && (
              <Badge>
                <CheckIcon aria-hidden /> Found all
              </Badge>
            )}
            {pick.outcome !== "picked" && (
              <Badge variant="secondary">
                <MinusIcon aria-hidden /> Found {quantityText(pick.pickedThousandths, line.unit)} of{" "}
                {quantityText(line.quantityThousandths, line.unit)}
              </Badge>
            )}
            {pick.substitute && (
              <Badge variant="outline">
                <RepeatIcon aria-hidden /> {quantityText(pick.substitute.quantityThousandths, "")}{" "}
                {pick.substitute.name} ·{" "}
                <Money amount={money(pick.substitute.gross)} className="inline" />
              </Badge>
            )}
          </span>
        )}
      </div>
      {picking && line.kind === "product" && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {pick?.outcome === "picked" ? null : (
            <Button size="sm" disabled={busy} onClick={onFoundAll}>
              <CheckIcon aria-hidden /> Found all
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={onShort}>
            Short or substitute…
          </Button>
        </div>
      )}
    </li>
  );
}
