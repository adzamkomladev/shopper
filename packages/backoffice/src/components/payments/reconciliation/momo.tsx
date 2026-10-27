import { Link } from "@tanstack/react-router";
import { CircleAlert, Clock, Wallet } from "lucide-react";
import { money, sub } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
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
import { Tile } from "../../register/tile";

/** MoMo against Paystack: payments still waiting on a payout, payouts that differ, and payments no sale used. */
export function MomoSettlement({ momo }: { momo: ReconciliationView["momo"] }) {
  return (
    <section aria-labelledby="momo-heading" className="flex flex-col gap-4">
      <h2 id="momo-heading" className="text-lg font-semibold tracking-tight">
        MoMo settlement
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        <div role="group" aria-label="Mismatches">
          <Tile
            icon={CircleAlert}
            label="Mismatches"
            value={String(momo.mismatches.length)}
            caption="Paid out at a different amount"
          />
        </div>
        <div role="group" aria-label="Unsettled">
          <Tile
            icon={Clock}
            label="Unsettled"
            value={String(momo.unsettled)}
            caption="Not paid out by Paystack yet"
          />
        </div>
        <div role="group" aria-label="Unapplied">
          <Tile
            icon={Wallet}
            label="Unapplied"
            value={String(momo.unapplied)}
            caption="Confirmed, but no sale used them"
          />
        </div>
      </div>
      {momo.mismatches.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table aria-label="Settlement mismatches">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-4">Receipt</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Sale</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Paid out</TableHead>
                  <TableHead className="px-4 text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {momo.mismatches.map((row) => (
                  <TableRow key={row.paymentId} className="h-14 hover:bg-transparent">
                    <TableCell className="px-4">
                      <div className="flex flex-col items-start gap-1">
                        <Link
                          to="/transactions/$saleId"
                          params={{ saleId: row.saleId }}
                          className="font-medium hover:underline"
                        >
                          {row.receiptNumber ?? "Sale"}
                        </Link>
                        <Badge variant="destructive">Amount mismatch</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {row.reference}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Money amount={money(row.expected)} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Money amount={money(row.settled)} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Money
                        amount={sub(money(row.settled), money(row.expected))}
                        className="font-semibold text-destructive"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
