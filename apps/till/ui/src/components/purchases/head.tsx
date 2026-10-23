import { TableHead, TableHeader, TableRow } from "@shopper/ui/components/table/primitive";

const head = "text-xs font-semibold text-muted-foreground";

/** The list's columns. The loading skeleton draws the same header, so the columns do not move when rows arrive. */
export function PurchaseHead() {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableHead className={`px-4 ${head}`}>Time / receipt</TableHead>
        <TableHead className={`hidden sm:table-cell ${head}`}>Customer</TableHead>
        <TableHead className={`hidden sm:table-cell ${head}`}>Payment</TableHead>
        <TableHead className={head}>Status</TableHead>
        <TableHead className={`px-4 text-right ${head}`}>Total</TableHead>
      </TableRow>
    </TableHeader>
  );
}
