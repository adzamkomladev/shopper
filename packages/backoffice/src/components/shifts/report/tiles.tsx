import { Landmark, Receipt, Undo2 } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import type { XReport } from "@shopper/core/schemas";
import { Tile } from "../../register/tile";

const cedis = (amount: number) => formatGHS(money(amount));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Sales, the tax in them and what was refunded. Each tile is a group so a reader can jump to it. */
export function ShiftTiles({ report }: { report: Pick<XReport, "sales" | "refunds"> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <div aria-label="Sales" role="group">
        <Tile
          caption={plural(report.sales.count, "sale", "sales")}
          icon={Receipt}
          label="Sales"
          value={cedis(report.sales.gross)}
        />
      </div>
      <div aria-label="Tax" role="group">
        <Tile
          caption="included in sales"
          icon={Landmark}
          label="Tax"
          value={cedis(report.sales.tax)}
        />
      </div>
      <div aria-label="Refunds" role="group">
        <Tile
          caption={plural(report.refunds.count, "refund", "refunds")}
          icon={Undo2}
          label="Refunds"
          value={cedis(report.refunds.total)}
        />
      </div>
    </div>
  );
}
