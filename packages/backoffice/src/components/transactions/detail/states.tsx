import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
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
      <div className="flex flex-col gap-3">
        <BackToTransactions />
        <Skeleton className="h-36 lg:h-18" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
        </div>
      </div>
    </div>
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
