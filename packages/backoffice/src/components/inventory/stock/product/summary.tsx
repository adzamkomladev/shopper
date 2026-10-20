import { money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Card } from "@shopper/ui/components/card";
import { Kbd } from "@shopper/ui/components/kbd";
import { Money } from "@shopper/ui/components/money";
import { quantityLabel } from "../../../../lib/inventory/format";
import type { StockProduct } from "../../../../queries/inventory/types";
import { LowBadge } from "../badge";

type Props = {
  product: StockProduct;
  /** Unit cost of the newest delivery that had one, or null if none did. */
  lastCost: number | null;
  /** Absent when the member cannot change levels. */
  onEdit?: () => void;
  editRef: React.Ref<HTMLButtonElement>;
};

/** On hand, the reorder level and the last unit cost, side by side. */
export function StockSummary({ product, lastCost, onEdit, editRef }: Props) {
  const { baseUnit, levelThousandths } = product;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="On hand">
        <div className="flex items-center gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {quantityLabel(product.onHandThousandths, baseUnit)}
          </p>
          {product.low && <LowBadge />}
        </div>
      </Stat>
      <Stat
        label="Reorder level"
        action={
          onEdit && (
            <Button
              ref={editRef}
              variant="outline"
              size="sm"
              aria-label="Edit reorder level"
              onClick={onEdit}
            >
              Edit
              <Kbd aria-hidden>E</Kbd>
            </Button>
          )
        }
      >
        {levelThousandths === null ? (
          <p className="text-2xl font-semibold text-muted-foreground">Not set</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums">
            {quantityLabel(levelThousandths, baseUnit)}
          </p>
        )}
      </Stat>
      <Stat label="Last unit cost">
        {lastCost === null ? (
          <p className="text-2xl font-semibold text-muted-foreground">No cost yet</p>
        ) : (
          <Money amount={money(lastCost)} className="text-left text-2xl font-semibold" />
        )}
      </Stat>
    </div>
  );
}

type StatProps = { label: string; action?: React.ReactNode; children: React.ReactNode };

function Stat({ label, action, children }: StatProps) {
  return (
    <Card className="min-h-28 justify-between gap-2 px-4 py-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-sm whitespace-nowrap text-muted-foreground">{label}</p>
        {action}
      </div>
      {children}
    </Card>
  );
}
