import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table";
import { money } from "@shopper/money";
import type { JournalEntryView } from "../../../schemas/ledger/views";
import { SourceLink } from "../source";

type Props = {
  entries: JournalEntryView[];
  /** Offered on entries not yet reversed, to members who may post. */
  onReverse?: (entry: JournalEntryView, trigger: string) => void;
};

/** Entries newest first, each with its lines: debits first, then credits, in two columns. */
export function JournalList({ entries, onReverse }: Props) {
  return (
    <ol aria-label="Journal entries" className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id}>
          <section
            aria-label={`${entry.postedOn} ${entry.memo}`}
            className="rounded-lg border bg-card shadow-sm"
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
              <span className="text-sm font-medium tabular-nums">{entry.postedOn}</span>
              <span className="text-sm font-semibold">{entry.memo}</span>
              <span className="text-sm text-muted-foreground">
                <SourceLink source={entry.source} id={entry.sourceId} />
              </span>
              {entry.reversedBy && <Badge variant="secondary">Reversed</Badge>}
              {onReverse && !entry.reversedBy && entry.source === "manual" && (
                <Button
                  id={`reverse-${entry.id}`}
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => onReverse(entry, `reverse-${entry.id}`)}
                >
                  Reverse<span className="sr-only"> {entry.memo}</span>
                </Button>
              )}
            </header>
            <Table bare scrollable aria-label={`Lines of ${entry.memo}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.lines.map((line) => (
                  <TableRow key={line.accountId}>
                    <TableCell className={line.amount < 0 ? "pl-8" : undefined}>
                      <span className="tabular-nums text-muted-foreground">{line.code}</span>{" "}
                      {line.name}
                    </TableCell>
                    <TableCell>
                      {line.amount > 0 && <Money amount={money(line.amount)} />}
                    </TableCell>
                    <TableCell>
                      {line.amount < 0 && <Money amount={money(-line.amount)} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </li>
      ))}
    </ol>
  );
}
