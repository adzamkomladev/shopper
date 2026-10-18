import { CircleDollarSign, CirclePercent, HandCoins, Box } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import type { RegisterReport } from "@shopper/core/schemas";
import { Tile } from "../tile";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Figma tiles that this register's data backs. Customers and Returning customers wait for a customer module. */
export function DashboardTiles({ report }: { report: RegisterReport }) {
  const { totals, returns, products, discountedSales } = report;
  return (
    <>
      <Tile
        caption={plural(totals.transactions, "transaction")}
        icon={CircleDollarSign}
        label="Total sales"
        value={formatGHS(money(totals.sales))}
      />
      <Tile
        caption={plural(returns.count, "return")}
        icon={HandCoins}
        label="Total returns"
        value={formatGHS(money(returns.amount))}
      />
      <Tile
        caption="in this register's catalogue"
        icon={Box}
        label="Products"
        value={String(products)}
      />
      <Tile
        caption={`${formatGHS(money(totals.discounts))} off`}
        icon={CirclePercent}
        label="Discounted sales"
        value={String(discountedSales)}
      />
    </>
  );
}
