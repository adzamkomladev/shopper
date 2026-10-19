import { CircleSlash, WifiOff } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { nothingLeft } from "../../../purchases/policy";
import type { ReturnState } from "../../../sale/types";

/** The return screen laid out in grey while the host checks what may still go back. */
export function ReturnSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12" role="status">
      <span className="sr-only">Loading return</span>
      <div aria-hidden="true" className="rounded-lg border bg-card p-4 xl:col-span-8">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }, (_, index) => (
          <div className="mt-4 flex items-center justify-between gap-4" key={index}>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-11 w-36" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid content-start gap-4 xl:col-span-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}

/** A return that cannot go ahead: nothing left on the sale, another register's sale offline, or a refused check. */
export function ReturnStop({
  state,
  onRetry,
}: {
  state: Exclude<ReturnState, { status: "loading" }>;
  onRetry: () => void;
}) {
  const offline = state.status === "failed" && state.code === "OFFLINE_UNAVAILABLE";
  const title =
    state.status === "ready"
      ? nothingLeft
      : offline
        ? "This sale is on another register"
        : "The return could not be started";
  const text =
    state.status === "ready"
      ? "Every line is final sale or has already been returned."
      : state.message;
  const Icon = offline ? WifiOff : CircleSlash;
  return (
    <Empty className="rounded-lg border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription role={state.status === "failed" ? "alert" : undefined}>
          {text}
        </EmptyDescription>
      </EmptyHeader>
      {state.status === "failed" && !offline && (
        <Button onClick={onRetry} size="touch" type="button" variant="outline">
          Try again
        </Button>
      )}
      {offline && (
        <Button onClick={onRetry} size="touch" type="button" variant="outline">
          Check the connection again
        </Button>
      )}
    </Empty>
  );
}
