import { Box, CircleDollarSign, CirclePercent, HandCoins, UserCheck, Users } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import type { RegisterReport } from "@shopper/core/schemas";
import { Tile } from "../tile";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Figma tiles, in its order: sales, customers and products over returns, returning customers and discounts. */
export function DashboardTiles({ report }: { report: RegisterReport }) {
  const { totals, returns, products, discountedSales, customers, returningCustomers } = report;
  return (
    <>
      <Tile
        caption={plural(totals.transactions, "transaction")}
        icon={CircleDollarSign}
        label="Total sales"
        value={formatGHS(money(totals.sales))}
      />
      <Tile
        caption="bought in this range"
        icon={Users}
        label="Customers"
        value={String(customers)}
      />
      <Tile
        caption="in this register's catalogue"
        icon={Box}
        label="Products"
        value={String(products)}
      />
      <Tile
        caption={plural(returns.count, "return")}
        icon={HandCoins}
        label="Total returns"
        value={formatGHS(money(returns.amount))}
      />
      <Tile
        caption="bought here before"
        icon={UserCheck}
        label="Returning customers"
        value={String(returningCustomers)}
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
