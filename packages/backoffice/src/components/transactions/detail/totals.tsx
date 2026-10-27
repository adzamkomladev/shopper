import { add, formatGHS, money, sub, type Money } from "@shopper/money";
import { Card, CardDescription, CardHeader, CardTitle } from "@shopper/ui/components/card";
import type { TransactionDetail } from "../../../schemas/transactions";

/** What the receipt added up to: discounts and tax as captured, cash rounding, refunds since and the total paid. */
export function TransactionTotals({ sale }: { sale: TransactionDetail }) {
  const sum = (values: number[]) =>
    values.reduce<Money>((total, value) => add(total, money(value)), money(0));
  const discount = sum(sale.lines.map((line) => line.discount));
  const tax = sum(
    sale.lines.flatMap((line) => [line.tax.vat, line.tax.nhil, line.tax.getfund, line.tax.covid]),
  );
  const refunded = sum(sale.refunds.map((refund) => refund.total));
  const rows = [
    ["Discounts", formatGHS(sub(money(0), discount))],
    ["Tax included", formatGHS(tax)],
    ...(sale.cashRounding ? [["Cash rounding", formatGHS(money(sale.cashRounding))]] : []),
    ["Refunded", formatGHS(sub(money(0), refunded))],
  ];
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg">Order total</CardTitle>
        <CardDescription>Amounts captured on receipt {sale.receiptNumber}</CardDescription>
      </CardHeader>
      <dl className="grid gap-3 p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-semibold">Total paid</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatGHS(money(sale.total))}</dd>
        </div>
      </dl>
    </Card>
  );
}
