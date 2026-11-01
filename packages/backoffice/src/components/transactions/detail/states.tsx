import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Card, CardDescription, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { ApiError } from "../../../api/client";
import { routeStates } from "../../route/states";
import { BackToTransactions } from "./header";

/** The header card, items, totals and payment of the loaded sale, so nothing moves when it arrives. */
export function TransactionSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the transaction"
    >
      <header className="flex flex-col gap-3">
        <BackToTransactions />
        <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0" />
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-5.5 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {["w-37", "w-24", "w-28"].map((width) => (
                <div key={width} className="flex flex-col gap-0.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className={`h-5 ${width}`} />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-8 w-33" />
        </Card>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <ItemsCardSkeleton />
          <ListCardSkeleton rows={6} description={false} />
          <Card className="gap-0 py-0">
            <CardTop description />
            <div className="grid divide-y">
              {[0, 1, 2].map((row) => (
                <div key={row} className="px-4 py-3">
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <Card className="gap-0 py-0">
            <CardTop description />
            <div className="grid gap-3 p-4">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <div className="border-t pt-3">
                <Skeleton className="ml-auto h-8 w-40" />
              </div>
            </div>
          </Card>
          <Card className="gap-0 py-0">
            <CardTop description />
            <div className="grid gap-3 p-4">
              <Skeleton className="h-12" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CardTop({ description }: { description: boolean }) {
  return (
    <CardHeader className="border-b py-4">
      <CardTitle>
        <Skeleton className="h-6 w-40" />
      </CardTitle>
      {description && (
        <CardDescription>
          <Skeleton className="h-5 w-64 max-w-full" />
        </CardDescription>
      )}
    </CardHeader>
  );
}

/** A card of short rows: the receipt metadata. */
function ListCardSkeleton({ rows, description }: { rows: number; description: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <CardTop description={description} />
      <div className="grid gap-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
    </Card>
  );
}

/** The items card: its header, the lines' table and the footer's total. */
function ItemsCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b py-4">
        <div className="grid gap-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-5.5 w-16 rounded-full" />
      </CardHeader>
      <Table bare>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              <TableCell className="py-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-5 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-5 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={3}>
              <Skeleton className="ml-auto h-5 w-24" />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}

/** A sale that is not the org's, or outside the member's branches, is not found; anything else can retry. */
export function TransactionError(props: ErrorComponentProps) {
  const router = useRouter();
  const status = props.error instanceof ApiError ? props.error.status : undefined;
  const Fallback = routeStates.errorComponent;
  if (status === 403) return <Fallback {...props} />;
  const missing = status === 404;
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h1>{missing ? "Transaction not found" : "Something went wrong"}</h1>
        </EmptyTitle>
        <EmptyDescription>
          {missing
            ? "It doesn't exist, belongs to another shop, or was rung up at a branch you don't manage."
            : "The transaction could not be loaded. Check the connection and try again."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {!missing && (
          <Button
            variant="outline"
            onClick={() => {
              props.reset();
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/transactions">Back to transactions</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
