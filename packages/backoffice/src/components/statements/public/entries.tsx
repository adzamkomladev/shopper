import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { entryName, signedGHS, statementDay } from "../../../lib/statements/format";
import type { StatementDocument } from "@shopper/core/schemas";

/** Every entry in the period, oldest first, with the balance after it. The date sits under the name on a phone. */
export function Entries({ entries }: { entries: StatementDocument["entries"] }) {
  if (entries.length === 0)
    return (
      <p className="rounded-lg border p-5 text-sm text-muted-foreground">
        Nothing was bought or paid in this period.
      </p>
    );
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table aria-label="Entries">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground">
              Entry
            </TableHead>
            <TableHead className="h-10 bg-muted/50 px-4 text-right text-xs font-semibold text-muted-foreground">
              Amount
            </TableHead>
            <TableHead className="h-10 bg-muted/50 px-4 text-right text-xs font-semibold text-muted-foreground">
              Balance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="px-4 whitespace-normal">
                <div className="flex flex-col">
                  <span className="font-medium">{entryName(entry.kind, entry.method)}</span>
                  <time dateTime={entry.occurredAt} className="text-xs text-muted-foreground">
                    {statementDay(entry.occurredAt)}
                  </time>
                </div>
              </TableCell>
              <TableCell className="px-4 text-right tabular-nums">
                {signedGHS(entry.amount)}
              </TableCell>
              <TableCell className="px-4 text-right tabular-nums">
                {signedGHS(entry.balance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
