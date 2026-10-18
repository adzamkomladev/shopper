import { Landmark, Percent, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import type { RegisterReport } from "@shopper/core/schemas";
import { Tile } from "../tile";

/** The report's totals: what was taken, how many sales, the tax in it and what discounts gave away. */
export function ReportSummary({ report: { totals } }: { report: RegisterReport }) {
  const cedis = (amount: number) => formatGHS(money(amount));
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      <Tile caption="including tax" icon={Wallet} label="Total sales" value={cedis(totals.sales)} />
      <Tile
        caption="completed sales"
        icon={Receipt}
        label="Transactions"
        value={String(totals.transactions)}
      />
      <Tile caption="levies and VAT" icon={Landmark} label="Tax" value={cedis(totals.tax)} />
      <Tile
        caption="taken off prices"
        icon={Percent}
        label="Discounts"
        value={cedis(totals.discounts)}
      />
      <Tile
        caption="sales without tax"
        icon={ShoppingBag}
        label="Net sales"
        value={cedis(totals.net)}
      />
    </div>
  );
}
