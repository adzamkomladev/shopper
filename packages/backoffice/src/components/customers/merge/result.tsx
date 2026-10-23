import { add } from "@shopper/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table";
import type { CustomerView } from "../../../queries/customers/types";
import { Balance } from "../balance";

type Props = { keep: CustomerView; fold: CustomerView };

/** Both accounts and what the kept customer holds once the other is folded in. */
export function MergeResult({ keep, fold }: Props) {
  return (
    <Table aria-label="Accounts after the merge" className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Owed</TableHead>
          <TableHead className="text-right">Points</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <Row label={keep.name} note="Kept" customer={keep} />
        <Row label={fold.name} note="Merged in, then archived" customer={fold} />
        <TableRow className="font-medium">
          <TableCell>Result</TableCell>
          <TableCell>
            <Balance balance={add(keep.balance, fold.balance)} />
          </TableCell>
          <TableCell className="text-right tabular-nums">{keep.points + fold.points}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function Row({ label, note, customer }: { label: string; note: string; customer: CustomerView }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <div className="flex flex-col">
          <span className="wrap-break-word">{label}</span>
          <span className="text-xs text-muted-foreground">{note}</span>
        </div>
      </TableCell>
      <TableCell>
        <Balance balance={customer.balance} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{customer.points}</TableCell>
    </TableRow>
  );
}
