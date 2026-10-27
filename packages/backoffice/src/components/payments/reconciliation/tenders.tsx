import { formatGHS, money } from "@shopper/money";
import { Money } from "@shopper/ui/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import type { ReconciliationView } from "../../../schemas/reconciliation";
import { VarianceBadge } from "../../shifts/list/badge";
import { tenderLabel } from "../../transactions/list/format";

/**
 * Each tender for the day: what the tills took (less refunds), what the Z reports expected and the cashiers
 * declared, the variance, and for MoMo what Paystack paid out.
 */
export function TenderTable({ tenders }: { tenders: ReconciliationView["tenders"] }) {
  return (
    <section aria-label="By tender" className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table aria-label="By tender">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4">Tender</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Taken</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Expected</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Declared</TableHead>
            <TableHead>Variance</TableHead>
            <TableHead className="hidden px-4 text-right sm:table-cell">Settled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenders.map((row) => (
            <TableRow key={row.tender} className="h-14 hover:bg-transparent">
              <TableCell className="px-4 font-medium">{tenderLabel(row.tender)}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <Money amount={money(row.taken)} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Money amount={money(row.expected)} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Money amount={money(row.declared)} />
              </TableCell>
              <TableCell>
                <VarianceBadge short={Math.min(row.variance, 0)} over={Math.max(row.variance, 0)} />
              </TableCell>
              <TableCell className="hidden px-4 text-right tabular-nums sm:table-cell">
                {row.settled === null ? (
                  <>
                    <span aria-hidden className="text-muted-foreground">
                      —
                    </span>
                    <span className="sr-only">Not settled by a provider</span>
                  </>
                ) : (
                  formatGHS(money(row.settled))
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
