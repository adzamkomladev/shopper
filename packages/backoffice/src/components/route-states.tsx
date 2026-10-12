import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent } from "@shopper/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { ApiError } from "../api/client";

// A skeleton shows after this long, so a fast load never flashes one.
const PENDING_MS = 300;

/** Shared by every route: a layout-shaped skeleton while loading and one error screen. */
export const routeStates = {
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  pendingMs: PENDING_MS,
};

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <AppBackdrop
      className="flex flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex items-center gap-6">
        <Skeleton className="h-9 w-50" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-9 w-72" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <PageSkeleton />
    </AppBackdrop>
  );
}

export function LoginSkeleton() {
  return (
    <AppBackdrop
      className="grid place-items-center bg-transparent p-0 shadow-none"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Card className="w-full max-w-3xl rounded-3xl border-0 p-10">
        <CardContent className="flex flex-col gap-9">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </CardContent>
      </Card>
    </AppBackdrop>
  );
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 403) {
    return (
      <Message
        title="You don't have permission"
        description="Ask the shop owner to give your role access to this page."
      />
    );
  }
  if (status === 404) {
    return (
      <Message
        title="Not found"
        description="This page or record doesn't exist, or it was removed."
      >
        <Button asChild variant="outline">
          <Link to="/products">Back to products</Link>
        </Button>
      </Message>
    );
  }
  return (
    <Message
      title="Something went wrong"
      description={error instanceof Error ? error.message : "Try again in a moment."}
    >
      <Button
        variant="outline"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
    </Message>
  );
}

function Message({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
