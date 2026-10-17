import { formatGHS, money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import type { PurchaseActions, PurchasesSnapshot } from "../../sale/types";

export function PurchaseRows({
  snapshot,
  actions,
  pageCount,
  onPage,
}: {
  snapshot: PurchasesSnapshot;
  actions: PurchaseActions;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const { status, purchases } = snapshot;
  if (status === "loading" || status === "idle")
    return (
      <div
        className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card text-sm text-muted-foreground"
        role="status"
      >
        <div className="flex min-h-64 w-full flex-col px-4">
          <span className="sr-only">Loading purchases</span>
          <div aria-hidden="true" className="grid grid-cols-3 gap-4 border-b py-4 md:grid-cols-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-4 w-20 justify-self-end" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              aria-hidden="true"
              className="grid grid-cols-3 gap-4 border-b py-4 md:grid-cols-5"
              key={index}
            >
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="hidden h-5 w-24 sm:block" />
              <Skeleton className="hidden h-5 w-20 md:block" />
              <Skeleton className="h-5 w-20 justify-self-end" />
            </div>
          ))}
          <div aria-hidden="true" className="mt-auto flex items-center justify-between py-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      </div>
    );
  if (status === "empty")
    return (
      <div className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card text-center">
        <div>
          <p className="font-semibold">No purchases today</p>
          <p className="mt-1 text-sm text-muted-foreground">Completed sales will appear here.</p>
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
      <section
        aria-label="Today’s purchases"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Button
                      className="min-h-11 px-0 font-semibold"
                      onClick={() => actions.read(purchase.id)}
                      size="touch"
                      variant="link"
                    >
                      Receipt {purchase.receiptNumber ?? purchase.id.slice(0, 8)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={purchase.status === "completed" ? undefined : "outline"}>
                      {statusLabel(purchase.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{purchase.kinds.map(tenderLabel).join(" + ") || "—"}</TableCell>
                  <TableCell>{accraTime(purchase.occurredAt)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatGHS(money(purchase.total))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {snapshot.total} {snapshot.total === 1 ? "purchase" : "purchases"} · page{" "}
            {snapshot.page} of {pageCount}
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

function statusLabel(status: string) {
  return status === "pending" ? "Pending MoMo" : status[0]!.toUpperCase() + status.slice(1);
}
function tenderLabel(kind: string) {
  return kind === "momo" ? "Mobile money" : kind[0]!.toUpperCase() + kind.slice(1);
}
function accraTime(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
