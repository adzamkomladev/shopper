import { Money } from "@shopper/ui/components/money";
import { reviewTotals } from "../../../../lib/inventory/takes";
import type { TakeDetail } from "../../../../queries/inventory/types";
import { Stat } from "../../stat";

/** What the count comes to: how much is counted, how many lines are out, and what the difference is worth. */
export function ReviewSummary({ take }: { take: TakeDetail }) {
  const { moved, unvalued, value } = reviewTotals(take.lines);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Counted">
        <p className="text-2xl font-semibold tabular-nums">
          {take.lines.length - take.uncounted} of {take.lines.length}
        </p>
      </Stat>
      <Stat label="Lines with a variance">
        <p className="text-2xl font-semibold tabular-nums">{moved}</p>
      </Stat>
      <Stat label="Variance value">
        <div>
          <Money amount={value} className="text-left text-2xl font-semibold" />
          {unvalued > 0 && (
            <p className="text-xs text-muted-foreground">
              {unvalued} {unvalued === 1 ? "line has" : "lines have"} no cost and{" "}
              {unvalued === 1 ? "isn't" : "aren't"} valued
            </p>
          )}
        </div>
      </Stat>
    </div>
  );
}
