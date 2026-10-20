import { money } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import type { Valuation } from "../../../queries/inventory/types";
import { Stat } from "../stat";

/** The total value of the branch's stock, and how many lines need a look (no cost, or negative stock). */
export function ValuationSummary({ valuation }: { valuation: Valuation }) {
  const flagged = valuation.lines.filter((line) => line.flag !== null).length;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
      <Stat label="Total value">
        <Money amount={money(valuation.total)} className="text-left text-2xl font-semibold" />
      </Stat>
      <Stat label="Products flagged">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{flagged}</p>
          <p className="text-xs text-muted-foreground">With no cost, or with stock below zero</p>
        </div>
      </Stat>
    </div>
  );
}
