import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table";
import { money } from "@shopper/money";
import type { AccountLine } from "../../../schemas/ledger/views";
import { SourceLink } from "../source";

type Props = { opening: number; closing: number; lines: AccountLine[] };

/** One account's lines with the running balance (debits +), from the balance brought forward to the one carried. */
export function AccountLines({ opening, closing, lines }: Props) {
  return (
    <Table scrollable aria-label="Account lines">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Entry</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Debit</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Credit</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell />
          <TableCell className="text-muted-foreground">Brought forward</TableCell>
          <TableCell className="hidden sm:table-cell" />
          <TableCell className="hidden sm:table-cell" />
          <TableCell>
            <Money amount={money(opening)} />
          </TableCell>
        </TableRow>
        {lines.map((line) => (
          <TableRow key={`${line.entryId}-${line.memo}`}>
            <TableCell className="tabular-nums">{line.postedOn}</TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex flex-col">
                <span>{line.memo}</span>
                <span className="text-xs text-muted-foreground">
                  <SourceLink source={line.source} id={line.sourceId} />
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {line.amount > 0 && <Money amount={money(line.amount)} />}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {line.amount < 0 && <Money amount={money(-line.amount)} />}
            </TableCell>
            <TableCell>
              <Money amount={money(line.balance)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell />
          <TableCell className="font-semibold">Carried forward</TableCell>
          <TableCell className="hidden sm:table-cell" />
          <TableCell className="hidden sm:table-cell" />
          <TableCell className="font-semibold">
            <Money amount={money(closing)} />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
