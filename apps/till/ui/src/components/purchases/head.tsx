import { TableHead, TableHeader, TableRow } from "@shopper/ui/components/table/primitive";

/** The list's columns. The loading skeleton draws the same header, so the columns do not move when rows arrive. */
export function PurchaseHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Time / receipt</TableHead>
        <TableHead className="hidden sm:table-cell">Customer</TableHead>
        <TableHead className="hidden sm:table-cell">Payment</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
  );
}
