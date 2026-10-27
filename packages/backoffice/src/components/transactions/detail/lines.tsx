import { add, money, sub, type Money as Amount } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import type { TransactionDetail } from "../../../schemas/transactions";
import { quantity } from "./format";

type Line = TransactionDetail["lines"][number];
const lineTax = (line: Line) =>
  add(
    add(money(line.tax.vat), money(line.tax.nhil)),
    add(money(line.tax.getfund), money(line.tax.covid)),
  );

/** The lines as sold: quantity, unit price, discount and the tax snapshot taken at the till. */
export function TransactionLines({ lines }: { lines: TransactionDetail["lines"] }) {
  const count = lines.length;
  const gross = lines.reduce<Amount>((sum, line) => add(sum, money(line.total)), money(0));
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b py-4">
        <div className="grid gap-1">
          <CardTitle className="text-lg">Items purchased</CardTitle>
          <CardDescription>Quantities, prices and tax captured at the time of sale</CardDescription>
        </div>
        <Badge variant="secondary">
          {count} {count === 1 ? "line" : "lines"}
        </Badge>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table aria-label="Items purchased">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4">Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="hidden text-right md:table-cell">Unit price</TableHead>
              <TableHead className="hidden text-right md:table-cell">Discount</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Tax</TableHead>
              <TableHead className="px-4 text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id} className="hover:bg-transparent">
                <TableCell className="px-4 py-3 whitespace-normal">
                  <div className="font-medium">{line.name}</div>
                  {line.sku && <div className="text-xs text-muted-foreground">SKU {line.sku}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{quantity(line.quantity)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Money amount={money(line.unitPrice)} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {line.discount ? (
                    <Money amount={sub(money(0), money(line.discount))} />
                  ) : (
                    <span className="block text-right text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Money amount={lineTax(line)} />
                </TableCell>
                <TableCell className="px-4">
                  <Money amount={money(line.total)} className="font-semibold" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-muted/50">
              {/* One cell across the table, whichever columns the width shows. */}
              <TableCell colSpan={6} className="px-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-normal text-muted-foreground">
                    Lines total, tax included
                  </span>
                  <Money amount={gross} className="font-semibold" />
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Card>
  );
}
