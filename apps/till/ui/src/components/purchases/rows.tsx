import { cn } from "cn";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Table, TableBody, TableCell, TableRow } from "@shopper/ui/components/table/primitive";
import type { PurchaseActions, PurchaseSummary, PurchasesSnapshot } from "../../sale/types";
import { accraTime, formatSigned, statusLabel, tenderLabel } from "../../purchases/format";
import { PurchaseCustomer } from "./customer";
import { PurchaseHead } from "./head";
import { FindOnServer, LookupAlert } from "./lookup";
import { PurchaseSkeleton } from "./skeleton";

export function PurchaseRows({
  snapshot,
  actions,
  online,
  pageCount,
  onPage,
}: {
  snapshot: PurchasesSnapshot;
  actions: PurchaseActions;
  online: boolean;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const { status, purchases, filters } = snapshot;
  const searching = filters.query.trim() !== "";
  if (status === "loading" || status === "idle") return <PurchaseSkeleton />;
  if (status === "empty" && searching)
    return (
      <FindOnServer
        lookup={snapshot.lookup}
        online={online}
        onFind={() => actions.lookup(filters.query.trim())}
        query={filters.query.trim()}
      />
    );
  if (status === "empty")
    return (
      <div className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card text-center">
        <div>
          <p className="font-semibold">
            {filters.status === "all" ? "No purchases today" : "Nothing in this tab today"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filters.status === "all"
              ? "Completed sales will appear here."
              : "Choose another tab to see the rest."}
          </p>
        </div>
      </div>
    );
  if (status === "offline")
    return (
      <div className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card px-5 text-center text-sm text-muted-foreground">
        Purchases are unavailable while the register host is offline
      </div>
    );
  if (status === "error")
    return (
      <div className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card px-5 text-center">
        <div>
          <p className="font-semibold">Purchases could not be loaded</p>
          <p role="alert" className="mt-1 text-sm text-muted-foreground">
            {snapshot.error}
          </p>
        </div>
      </div>
    );
  return (
    <>
      {snapshot.error && (
        <div className="rounded-md border border-destructive/50 px-4 py-3" role="alert">
          <p className="font-medium">Receipt could not be opened</p>
          <p className="text-sm text-muted-foreground">{snapshot.error}</p>
          <p className="text-sm text-muted-foreground">Select the receipt again to retry.</p>
        </div>
      )}
      <LookupAlert lookup={snapshot.lookup} />
      <section
        aria-label={searching ? "Matching purchases" : "Today’s purchases"}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <PurchaseHead />
            <TableBody>
              {purchases.map((purchase) => (
                <PurchaseRow actions={actions} key={purchase.id} purchase={purchase} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Page {snapshot.page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={snapshot.page <= 1}
              onClick={() => onPage(snapshot.page - 1)}
              size="touch"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={snapshot.page >= pageCount}
              onClick={() => onPage(snapshot.page + 1)}
              size="touch"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/** A Returns row has no receipt number of its own: it opens the sale it returned. */
function PurchaseRow({
  purchase,
  actions,
}: {
  purchase: PurchaseSummary;
  actions: PurchaseActions;
}) {
  const refund = purchase.refundOf;
  const reference = refund ?? purchase.receiptNumber ?? purchase.id.slice(0, 8);
  return (
    <TableRow>
      <TableCell className="px-4">
        <Button
          className="h-auto min-h-11 flex-col items-start gap-0 px-0 py-1 text-left"
          onClick={() => (refund ? actions.lookup(refund) : actions.read(purchase.id))}
          size="touch"
          variant="link"
        >
          <span className="font-semibold text-foreground">{accraTime(purchase.occurredAt)}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {refund ? `Return of #${refund}` : `#${reference}`}
          </span>
        </Button>
      </TableCell>
      <TableCell className="hidden max-w-48 sm:table-cell">
        <PurchaseCustomer customer={purchase.customer} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {purchase.kinds.map(tenderLabel).join(" + ") || "—"}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            purchase.status === "completed"
              ? undefined
              : purchase.status === "voided"
                ? "destructive"
                : purchase.status === "pending"
                  ? "secondary"
                  : "outline"
          }
        >
          {purchase.status === "pending" ? "Pending" : statusLabel(purchase.status)}
        </Badge>
        {purchase.refunded !== "none" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {purchase.refunded === "full" ? "Fully refunded" : "Partly refunded"}
          </p>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "px-4 text-right font-semibold tabular-nums",
          purchase.status === "voided" && "text-muted-foreground",
        )}
      >
        {formatSigned(purchase.total)}
      </TableCell>
    </TableRow>
  );
}
