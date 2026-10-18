import { formatGHS, money } from "@shopper/money";
import type { RegisterReport } from "@shopper/core/schemas";
import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { formatQuantity } from "@shopper/utils";

const methods = { cash: "Cash", momo: "Mobile money", card: "Card" } as const;
const right = "text-right";

export function TendersTable({ tenders }: { tenders: RegisterReport["tenders"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Method</TableHead>
          <TableHead className={right}>Taken</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenders.map((tender) => (
          <TableRow key={tender.method}>
            <TableCell>{methods[tender.method]}</TableCell>
            <TableCell>
              <Money amount={money(tender.amount)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ProductsTable({ products }: { products: RegisterReport["topProducts"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className={right}>Sold</TableHead>
          <TableHead className={right}>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.productId}>
            <TableCell className="max-w-0 truncate">{product.name}</TableCell>
            <TableCell className={`${right} tabular-nums`}>
              {formatQuantity(product.quantityThousandths)}
            </TableCell>
            <TableCell>
              <Money amount={money(product.amount)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The hours that had sales, each with a bar sized against the busiest hour. */
export function HoursList({ hours }: { hours: RegisterReport["byHour"] }) {
  const busiest = Math.max(...hours.map((hour) => hour.amount));
  return (
    <ul className="flex flex-col divide-y">
      {hours.map((hour) => (
        <li className="flex items-center gap-4 px-4 py-3 text-sm" key={hour.hour}>
          <span className="w-12 shrink-0 tabular-nums">
            {String(hour.hour).padStart(2, "0")}:00
          </span>
          <span aria-hidden className="h-2 min-w-0 flex-1 rounded-full bg-muted">
            {/* Bar length is a drawing ratio, not money, so a plain division is fine. */}
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(hour.amount / busiest) * 100}%` }}
            />
          </span>
          <span className="w-28 shrink-0 text-right tabular-nums">
            {formatGHS(money(hour.amount))}
          </span>
          <span className="w-16 shrink-0 text-right text-muted-foreground tabular-nums">
            {hour.count === 1 ? "1 sale" : `${hour.count} sales`}
          </span>
        </li>
      ))}
    </ul>
  );
}
