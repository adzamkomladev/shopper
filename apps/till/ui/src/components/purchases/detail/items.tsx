import { add, formatGHS } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table";
import type { PurchaseDetails } from "@shopper/sync/bridge";
import { formatQuantity } from "../../../sale/quantity";

export function DetailItems({ purchase }: { purchase: PurchaseDetails }) {
  const receipt = purchase.receipt;
  const sale = purchase.sale;
  const draft = purchase.draft;
  return (
    <section
      aria-label="Items purchased"
      className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm xl:col-span-8"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">Items purchased</h3>
          <p className="text-xs text-muted-foreground">
            {receipt
              ? "Captured quantities and amounts"
              : "Saved draft quantities and register quote"}
          </p>
        </div>
        <Badge variant="secondary">
          {receipt?.lines.length ?? draft?.quote.lines.length ?? 0} items
        </Badge>
      </div>
      <div aria-label="Purchase item table" className="overflow-x-auto" role="region" tabIndex={0}>
        <table aria-label="Items purchased" className="min-w-176 w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-full">Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt
              ? receipt.lines.map((line, index) => {
                  const taxLine = sale?.lines[index]?.tax;
                  const tax = taxLine
                    ? add(add(taxLine.vat, taxLine.nhil), add(taxLine.getfund, taxLine.covid))
                    : null;
                  return (
                    <TableRow key={`${line.name}-${index}`}>
                      <TableCell className="max-w-64 whitespace-normal">
                        <span className="block font-medium">{line.name}</span>
                        <span className="text-xs text-muted-foreground">Unit: {line.unit}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(line.quantityThousandths)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGHS(line.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.discount ? `−${formatGHS(line.discount)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tax === null ? "—" : formatGHS(tax)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatGHS(line.gross)}
                      </TableCell>
                    </TableRow>
                  );
                })
              : draft?.quote.lines.map((line) => {
                  const source = draft.draft?.lines.find((item) => item.id === line.lineId);
                  if ("error" in line)
                    return (
                      <UnavailableLine key={line.lineId} quantity={source?.quantityThousandths} />
                    );
                  const tax = add(
                    add(line.tax.vat, line.tax.nhil),
                    add(line.tax.getfund, line.tax.covid),
                  );
                  return (
                    <TableRow key={line.lineId}>
                      <TableCell className="max-w-64 whitespace-normal">
                        <span className="block font-medium">{line.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {line.sku} · {line.baseUnit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {source
                          ? formatQuantity(source.quantityThousandths)
                          : formatQuantity(line.tax.quantityThousandths)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatGHS(line.tax.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.tax.discount ? `−${formatGHS(line.tax.discount)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatGHS(tax)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatGHS(line.tax.gross)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            {!receipt && !draft?.quote.lines.length && (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                  No item details are available for this purchase.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </section>
  );
}

function UnavailableLine({ quantity }: { quantity?: number }) {
  return (
    <TableRow>
      <TableCell className="font-medium">Unavailable product</TableCell>
      <TableCell className="text-right tabular-nums">
        {quantity ? formatQuantity(quantity) : "—"}
      </TableCell>
      <TableCell className="text-right">—</TableCell>
      <TableCell className="text-right">—</TableCell>
      <TableCell className="text-right">—</TableCell>
      <TableCell className="text-right text-muted-foreground">Not priced</TableCell>
    </TableRow>
  );
}
